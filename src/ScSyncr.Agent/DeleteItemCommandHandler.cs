using System.Web;
using Sitecore;
using Sitecore.Configuration;
using Sitecore.Data;
using Sitecore.Data.Items;
using Sitecore.Data.Proxies;
using Sitecore.SecurityModel;

namespace ScSyncr.Agent
{
    internal class DeleteItemCommandHandler : ICommandHandler
    {
        private static readonly object CachedObject = new object();
        private const string ReferralFoundMessage = "Item {0} - {1} or one of its children has referral links. As a precaution referral links must be deleted before the item.";
        public void Handle(HttpContext context)
        {
            var request = context.Request;
            string dbName = request.QueryString[ParameterKeys.Db];
            var db = Factory.GetDatabase(dbName, assert: true);

            var itemId = request.Form[ParameterKeys.ItemId];

            bool wasDeleted = false;
            string msg = null;
            using(new ProxyDisabler())
            using (new SecurityDisabler())
            {
                Item item = db.GetItem(ID.Parse(itemId));
                if (item == null)
                {
                    wasDeleted = true; //not found, assume it was deleted.
                }
                else
                {
                    if (IsSafeToDelete(item))
                    {
                        if (AgentConfig.RecycleInsteadOfDelete)
                        {
                            item.Delete();
                        }
                        else
                        {
                            item.Recycle();
                        }
                        wasDeleted = true;
                    }
                    else
                    {
                        msg = string.Format(ReferralFoundMessage, item.ID, item.Paths.ContentPath);
                    }
                }
            }

            if (wasDeleted)
            {
                context.Response.WriteJson(CachedObject);
            }
            else
            {
                context.Response.StatusCode = 400; //Bad Request
                context.Response.TrySkipIisCustomErrors = true;
                context.Response.WriteJson(new { Message = msg });
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