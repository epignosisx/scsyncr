using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using Sitecore.Data.Items;
using Sitecore.Data.Serialization.ObjectModel;
using Sitecore.Data;

namespace ScSyncr.Agent
{
    public static class Utils
    {
        public static string Md5Hash(string content)
        {
            MD5 md5 = new MD5CryptoServiceProvider();
            byte[] hash = md5.ComputeHash(Encoding.UTF8.GetBytes(content));
            return Convert.ToBase64String(hash);
        }

        public static StringBuilder SerializeSyncItem(SyncItem syncItem, StringBuilder sb = null)
        {
            sb = sb ?? new StringBuilder();
            using (var writer = new StringWriter(sb))
            {
                syncItem.Serialize(writer);
            }
            return sb;
        }

        //from:https://briancaos.wordpress.com/2011/01/14/create-and-publish-items-in-sitecore/
        public static void PublishItem(Item item)
        {
            // The publishOptions determine the source and target database,
            // the publish mode and language, and the publish date
            Sitecore.Publishing.PublishOptions publishOptions =
              new Sitecore.Publishing.PublishOptions(item.Database,
                                                     Database.GetDatabase("web"),
                                                     Sitecore.Publishing.PublishMode.SingleItem,
                                                     item.Language,
                                                     System.DateTime.Now);  // Create a publisher with the publishoptions
            Sitecore.Publishing.Publisher publisher = new Sitecore.Publishing.Publisher(publishOptions);

            // Choose where to publish from
            publisher.Options.RootItem = item;

            // Publish children as well?
            publisher.Options.Deep = true;

            // Do the publish!
            publisher.Publish();
        }
    }
}