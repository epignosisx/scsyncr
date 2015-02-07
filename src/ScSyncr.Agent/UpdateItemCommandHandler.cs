using System;
using System.IO;
using System.Web;
using System.Web.Script.Serialization;
using Sitecore.Configuration;
using Sitecore.Data.Items;
using Sitecore.Data.Serialization;
using Sitecore.Data.Serialization.ObjectModel;
using Sitecore.SecurityModel;

namespace ScSyncr.Agent
{
    internal class UpdateItemCommandHandler : ICommandHandler
    {
        public void Handle(HttpContext context)
        {
            var request = context.Request;
            if (!request.ContentType.StartsWith("application/json", StringComparison.OrdinalIgnoreCase))
            {
                context.Response.StatusCode = 400;
                context.Response.Write("Expected Content Type: application/json, but received: " + request.ContentType);
                return;
            }

            string dbName = request.QueryString[ParameterKeys.Db];
            var db = Factory.GetDatabase(dbName, assert: true);

            request.InputStream.Position = 0;//reset the stream so we can read the content
            byte[] rawBody = request.BinaryRead(request.ContentLength);
            string postBody = request.ContentEncoding.GetString(rawBody);

            JavaScriptSerializer serializer = new JavaScriptSerializer();
            ItemDto itemDto = serializer.Deserialize<ItemDto>(postBody);

            SyncItem syncItem;
            using (TextReader reader = new StringReader(itemDto.Raw))
            {
                syncItem = SyncItem.ReadItem(new Tokenizer(reader));
            }

            Item item = null;
            using (new SecurityDisabler())
            {
                ItemSynchronization.PasteSyncItem(syncItem, new LoadOptions {Database = db, ForceUpdate = true});
                item = db.GetItem(syncItem.ID);
            }

            SyncItem outItem = ItemSynchronization.BuildSyncItem(item);
            context.Response.WriteSyncItem(outItem);
        }
    }
}