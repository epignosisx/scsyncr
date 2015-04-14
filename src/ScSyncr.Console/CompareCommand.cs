using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Threading.Tasks;
using System.Web.Script.Serialization;

namespace ScSyncr.Console
{
    internal class CompareCommand
    {
        private const string DeletedAction = "D";
        private const string CreatedAction = "C";
        private const string ModifiedAction = "M";

        private const int MaxConcurrentRequests = 10;
        private readonly IOutputWriter _outputWriter;

        public CompareCommand(IOutputWriter outputWriter)
        {
            _outputWriter = outputWriter;
        }

        public int Execute(CompareOptions options)
        {
            return ExecuteAsync(options).Result;
        }

        public async Task<int> ExecuteAsync(CompareOptions options)
        {
            if (options == null)
                throw new ArgumentNullException("options");

            //get source history
            _outputWriter.WriteLine("Fetching source history...");
            string sourceResponse = await FetchHistory(options);
            
            JavaScriptSerializer serializer = new JavaScriptSerializer();
            serializer.MaxJsonLength = int.MaxValue/2;
            List<HistoryEntryDto> sourceEntries = serializer.Deserialize<List<HistoryEntryDto>>(sourceResponse);
            _outputWriter.WriteLine("History entries found: " + sourceEntries.Count);
            
            if (sourceEntries.Count == 0)
            {
                _outputWriter.WriteLine("No changes to sync");
                return 0;
            }

            //fetching target items to compare if sync is necessary. Doing parallel requests with a max
            _outputWriter.WriteLine("Fetching target items");
            var requests = new List<Task<ItemFetchResult>>(sourceEntries.Count);
            var completed = new List<Task<ItemFetchResult>>(sourceEntries.Count);

            foreach (var entry in sourceEntries)
            {
                if (requests.Count >= MaxConcurrentRequests)
                {
                    var completedTask = await Task.WhenAny(requests);
                    requests.Remove(completedTask);
                    completed.Add(completedTask);
                }

                Task<ItemFetchResult> task = FetchItemFromHistory(options.TargetUrl, options.Database, entry);
                requests.Add(task);
            }
            await Task.WhenAll(requests);
            completed.AddRange(requests);

            //show results and sync if requested
            foreach (var result in completed.Select(n => n.Result).OrderBy(n => n.HistoryEntry.CreatedOn))
            {
                if (result.TargetAction == TargetAction.Unknown)
                {
                    using (new ColorSwitcher(ConsoleColor.Red))
                    {
                        _outputWriter.WriteLine("! {0} - {1}", result.HistoryEntry.ItemId, result.HistoryEntry.Path);
                        _outputWriter.WriteLine(options.Verbose ? result.Exception.ToString() : result.Exception.Message);    
                    }
                }
                else if (result.TargetAction == TargetAction.Add)
                {
                    using (new ColorSwitcher(ConsoleColor.DarkGreen))
                    {
                        _outputWriter.WriteLine("+ {0} - {1}", result.HistoryEntry.ItemId, result.HistoryEntry.Path);
                        if (options.Sync)
                        {
                            AddItem(options, result.HistoryEntry);
                        }
                    }
                }
                else if (result.TargetAction == TargetAction.Delete)
                {
                    using (new ColorSwitcher(ConsoleColor.DarkRed))
                    {
                        _outputWriter.WriteLine("- {0} - {1}", result.HistoryEntry.ItemId, result.HistoryEntry.Path);
                        if (options.Sync)
                        {
                            DeleteItem(options.Database, options.TargetUrl, result.HistoryEntry.ItemId, options.Verbose);
                        }
                    }
                }
                else if (result.TargetAction == TargetAction.Update)
                {
                    using (new ColorSwitcher(ConsoleColor.DarkCyan))
                    {
                        _outputWriter.WriteLine("* {0} - {1}", result.HistoryEntry.ItemId, result.HistoryEntry.Path);
                        if (options.Sync)
                        {
                            GetAndUpdate(options, result);
                        }
                    }
                }
                else if (options.Verbose && result.TargetAction == TargetAction.None)
                {
                    _outputWriter.WriteLine("= {0} - {1}", result.HistoryEntry.ItemId, result.HistoryEntry.Path);
                }
            }

            return 0;
        }

        private void GetAndUpdate(CompareOptions options, ItemFetchResult result)
        {
            ItemFetchResult sourceItem = FetchItem(options.SourceUrl, options.Database, result.HistoryEntry.ItemId).Result;
            if (sourceItem.Found)
            {
                bool success = UpdateItem(options.TargetUrl, options.Database, sourceItem.ItemDto, options.Verbose);
                if(success)
                    _outputWriter.WriteLine("Synched");
            }
            else
            {
                using (new ColorSwitcher(ConsoleColor.Red))
                    _outputWriter.WriteLine("Source item " + result.HistoryEntry.ItemId + " not found");
            }
        }

        private void AddItem(CompareOptions options, HistoryEntryDto historyEntry)
        {
            var source = FetchItem(options.SourceUrl, options.Database, historyEntry.ItemId).Result;
            if (!source.Found)
            {
                using(new ColorSwitcher(ConsoleColor.Red))
                    _outputWriter.WriteLine("Source item " + historyEntry.ItemId + " not found");
                return;
            }

            Stack<ItemDto> updates = new Stack<ItemDto>();
            updates.Push(source.ItemDto);

            var target = FetchItem(options.TargetUrl, options.Database, source.ItemDto.Item.ParentID).Result;
            while (!target.Found)
            {
                source = FetchItem(options.SourceUrl, options.Database, source.ItemDto.Item.ParentID).Result;
                if (!source.Found)
                {
                    using (new ColorSwitcher(ConsoleColor.Red))
                        _outputWriter.WriteLine("Source item " + historyEntry.ParentId + " not found");
                    return;
                }
                
                updates.Push(source.ItemDto);
                target = FetchItem(options.TargetUrl, options.Database, source.ItemDto.Item.ParentID).Result;
            }

            while (updates.Count > 0)
            {
                ItemDto dto = updates.Pop();
                bool success = UpdateItem(options.TargetUrl, options.Database, dto, options.Verbose);
                if (!success)
                    return;
            }

            _outputWriter.WriteLine("Synched");
        }

        private bool UpdateItem(Uri sitecoreUri, string database, ItemDto item, bool verbose)
        {
            //ensure parent exists
            UriBuilder builder = new UriBuilder(sitecoreUri);
            builder.Path = "/scsyncr/update-item";
            builder.Query = string.Format("db={0}", Uri.EscapeDataString(database));
            
            JavaScriptSerializer serializer = new JavaScriptSerializer();
            serializer.MaxJsonLength = int.MaxValue/2;
            string payload = serializer.Serialize(item);

            using (WebClient webClient = new WebClient())
            {
                try
                {
                    webClient.Headers.Add("Content-Type", "application/json");
                    string response = webClient.UploadString(builder.Uri, "POST", payload);
                    return true;
                }
                catch (Exception ex)
                {
                    using (new ColorSwitcher(ConsoleColor.Red))
                        _outputWriter.WriteLine(verbose ? ex.ToString() : ex.Message);
                    return false;
                }
            }
        }

        private void DeleteItem(string database, Uri sitecoreUri, string itemId, bool verbose)
        {
            UriBuilder builder = new UriBuilder(sitecoreUri);
            builder.Path = "/scsyncr/delete-item";
            builder.Query = string.Format("db={0}", Uri.EscapeDataString(database));

            using (WebClient webClient = new WebClient())
            {
                try
                {
                    string response = webClient.UploadString(builder.Uri, "POST", "itemId=" + Uri.EscapeDataString(itemId) + "&force=1");
                    _outputWriter.WriteLine("Synched");
                }
                catch (Exception ex)
                {
                    using(new ColorSwitcher(ConsoleColor.Red))
                        _outputWriter.WriteLine(verbose ? ex.ToString() : ex.Message);
                }
            }
        }

        private static Task<ItemFetchResult> FetchItemFromHistory(Uri sitecoreUri, string database, HistoryEntryDto historyEntry)
        {
            return FetchItem(sitecoreUri, database, historyEntry.ItemId).ContinueWith<ItemFetchResult>(t =>
            {
                if (t.IsCompleted)
                    t.Result.HistoryEntry = historyEntry;
                return t.Result;
            });
        }

        private static async Task<ItemFetchResult> FetchItem(Uri sitecoreUri, string database, string itemId)
        {
            UriBuilder builder = new UriBuilder(sitecoreUri);
            builder.Path = "/scsyncr/get-item";
            builder.Query = string.Format("db={0}&itemId={1}", Uri.EscapeDataString(database), Uri.EscapeDataString(itemId));
            

            using (WebClient webClient = new WebClient())
            {
                try
                {
                    string response = await webClient.DownloadStringTaskAsync(builder.Uri);
                    JavaScriptSerializer serializer = new JavaScriptSerializer();
                    serializer.MaxJsonLength = int.MaxValue/2;

                    ItemFetchResult result = new ItemFetchResult();
                    result.ItemDto = serializer.Deserialize<ItemDto>(response);
                    return result;
                }
                catch (WebException ex)
                {
                    ItemFetchResult result = new ItemFetchResult();
                    //check for item not found in sitecore
                    if (ex.Status == WebExceptionStatus.ProtocolError)
                    {
                        var response = ex.Response as HttpWebResponse;
                        if (response.StatusCode == HttpStatusCode.NotFound && response.StatusDescription == "Item not found")
                        {
                            return result;
                        }
                    }

                    //other type of error
                    result.Exception = ex;
                    return result;
                }
                catch (Exception ex)
                {
                    ItemFetchResult result = new ItemFetchResult();
                    result.Exception = ex;
                    return result;
                }
            }
        }
        
        private static Task<string> FetchHistory(CompareOptions options)
        {
            UriBuilder builder = new UriBuilder(options.SourceUrl);
            builder.Path = "/scsyncr/get-history";
            builder.Query = string.Format("db={0}&fd={1:s}&td={2:s}", Uri.EscapeDataString(options.Database), options.From, options.To);

            using (WebClient webClient = new WebClient())
            {
                return webClient.DownloadStringTaskAsync(builder.Uri);
            }
        }

        internal class HistoryEntryDto
        {
            public string ItemId { get; set; }
            public string ParentId { get; set; }
            public string Path { get; set; }
            public string Action { get; set; }
            public string Hash { get; set; }
            public DateTime CreatedOn { get; set; }
        }

        internal class ItemDto
        {
            public string Raw { get; set; }
            public string Hash { get; set; }
            public SyncItemDto Item { get; set; }
        }

        internal class SyncItemDto
        {
            public string ID { get; set; }
            public string ParentID { get; set; }
        }

        internal class ItemFetchResult
        {
            public HistoryEntryDto HistoryEntry { get; set; }
            public ItemDto ItemDto { get; set; }
            public Exception Exception { get; set; }
            public bool Found
            {
                get { return ItemDto != null; }
            }

            public TargetAction TargetAction
            {
                get
                {
                    if (Exception != null)
                        return TargetAction.Unknown;

                    if (!Found && HistoryEntry.Action != DeletedAction)
                        return TargetAction.Add;

                    if (Found && HistoryEntry.Action == DeletedAction)
                        return TargetAction.Delete;

                    if (Found && HistoryEntry.Action != DeletedAction && ItemDto.Hash != HistoryEntry.Hash)
                        return TargetAction.Update;

                    return TargetAction.None;
                }
            }
        }

        internal enum TargetAction
        {
            Unknown,
            None,
            Add,
            Delete,
            Update
        }
    }


}