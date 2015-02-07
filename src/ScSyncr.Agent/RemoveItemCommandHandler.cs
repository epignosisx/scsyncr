using System.Web;
using Sitecore;
using Sitecore.Configuration;
using Sitecore.Data;
using Sitecore.Data.Items;
using Sitecore.Data.Proxies;
using Sitecore.SecurityModel;

namespace ScSyncr.Agent
{
    internal class RemoveItemCommandHandler : ICommandHandler
    {
        public void Handle(HttpContext context)
        {
            var request = context.Request;
            string dbName = request.QueryString[ParameterKeys.Db];
            var db = Factory.GetDatabase(dbName, assert: true);

            var itemId = request.Form[ParameterKeys.ItemId];

            using(new ProxyDisabler())
            using (new SecurityDisabler())
            {
                Item item = db.GetItem(ID.Parse(itemId));
                if (IsSafeToDelete(item) && item != null)
                {
                    if (AgentConfig.RecycleInsteadOfDelete)
                    {
                        item.Delete();
                    }
                    else
                    {
                        item.Recycle();
                    }
                }
            }
        }

        private static bool IsSafeToDelete(Item item)
        {
            if (item != null)
            {
                if (item.TemplateID == TemplateIDs.Template)
                {
                    Sitecore.Links.ItemLink[] referrers = Globals.LinkDatabase.GetReferrers(item);
                    if (referrers.Length > 0)
                        return false;
                }

                foreach (Item child in item.Children)
                {
                    if (!IsSafeToDelete(child))
                        return false;
                }
            }
            return true;
        }
    }
}