using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Web;
using Sitecore.Collections;
using Sitecore.Data;
using Sitecore.Data.Engines;
using Sitecore.Data.Proxies;
using Sitecore.Data.Serialization.ObjectModel;
using Sitecore.Diagnostics;
using Sitecore.SecurityModel;

namespace ScSyncr.Agent
{
    internal class GetHistoryCommandHandler : ICommandHandler
    {
        private static readonly Dictionary<HistoryAction, string> HistoryActionMapping = new Dictionary<HistoryAction, string>
        {
            { HistoryAction.AddedVersion, "M" },
            { HistoryAction.RemovedVersion, "M" },
            { HistoryAction.Created, "C" },
            { HistoryAction.Copied, "C" },
            { HistoryAction.Deleted, "D" },
            { HistoryAction.Moved, "M" },
            { HistoryAction.Saved, "M" }
        };

        public void Handle(HttpContext context)
        {
            string database = context.Request.QueryString[ParameterKeys.Db];
            DateTime fromDate = DateTime.Parse(context.Request.QueryString[ParameterKeys.FromDate], CultureInfo.InvariantCulture);
            DateTime toDate = DateTime.Parse(context.Request.QueryString[ParameterKeys.ToDate], CultureInfo.InvariantCulture);

            using (new ProxyDisabler())
            using (new SecurityDisabler())
            {
                var db = Sitecore.Configuration.Factory.GetDatabase(database);
                var historyEngine = db.Engines.HistoryEngine;
                Assert.IsNotNull(historyEngine, "History engine is null");

                HistoryEntryCollection historyColl = historyEngine.GetHistory(fromDate, toDate);
                var modifiedItems = new Dictionary<ID, HistoryEntryDto>(historyColl.Count);
                StringBuilder sb = new StringBuilder();
                foreach (HistoryEntry entry in historyColl.OrderByDescending(n => n.Created))
                {
                    if (!modifiedItems.ContainsKey(entry.ItemId))
                    {
                        var dto = new HistoryEntryDto();
                        dto.ItemId = entry.ItemId.ToString();
                        dto.Action = HistoryActionMapping[entry.Action];
                        var item = db.GetItem(entry.ItemId);
                        if (item != null)
                        {
                            SyncItem seri = Sitecore.Data.Serialization.ItemSynchronization.BuildSyncItem(item);
                            sb.Clear();
                            Utils.SerializeSyncItem(seri, sb);
                            dto.Hash = Utils.Md5Hash(sb.ToString());
                        }

                        modifiedItems.Add(entry.ItemId, dto);
                    }
                }

                context.Response.WriteJson(modifiedItems.Values);
            }
        }
    }

    internal class HistoryEntryDto
    {
        public string ItemId { get; set; }
        public string Action { get; set; }
        public string Hash { get; set; }
    }
}