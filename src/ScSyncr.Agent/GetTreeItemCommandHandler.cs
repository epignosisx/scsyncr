using System;
using System.Collections.Generic;
using System.Text;
using System.Web;
using Sitecore.Data;
using Sitecore.Data.Items;
using Sitecore.Data.Proxies;
using Sitecore.Data.Serialization;
using Sitecore.Data.Serialization.ObjectModel;
using Sitecore.SecurityModel;

namespace ScSyncr.Agent
{
    internal class GetTreeItemCommandHandler : ICommandHandler
    {
        public void Handle(HttpContext context)
        {
            string database = context.Request.QueryString[ParameterKeys.Db];
            string id = context.Request.QueryString[ParameterKeys.ItemId];
            string host = context.Request.Url.GetLeftPart(UriPartial.Authority);

            using (new ProxyDisabler())
            using (new SecurityDisabler())
            {
                var db = Sitecore.Configuration.Factory.GetDatabase(database);
                Item item = db.GetItem(new ID(id));

                StringBuilder sb = new StringBuilder();
                SyncItem syncItem = ItemSynchronization.BuildSyncItem(item);
                string hash = Utils.Md5Hash(Utils.SerializeSyncItem(syncItem, sb).ToString());
                var dto = item.MapToTreeItemDto(hash, host);
                dto.Children = new List<TreeItemDto>();
                foreach (Item child in item.GetChildren())
                {
                    sb.Clear();
                    syncItem = ItemSynchronization.BuildSyncItem(child);
                    hash = Utils.Md5Hash(Utils.SerializeSyncItem(syncItem, sb).ToString());
                    dto.Children.Add(child.MapToTreeItemDto(hash, host));
                }
                context.Response.WriteJson(dto);
            }
        }
    }
}