using System;
using System.Linq;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using Sitecore.Data.Items;
using Sitecore.Data.Serialization.ObjectModel;
using Sitecore.Data;
using System.Collections.Generic;

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

        public static SyncItem GetLatestVersions(SyncItem syncItem)
        {
            SyncItem latestSeri = new SyncItem();
            latestSeri.ID = syncItem.ID;
            latestSeri.DatabaseName = syncItem.DatabaseName;
            latestSeri.ItemPath = syncItem.ItemPath;
            latestSeri.ParentID = syncItem.ParentID;
            latestSeri.Name = syncItem.Name;
            latestSeri.MasterID = syncItem.MasterID;
            latestSeri.TemplateID = syncItem.TemplateID;
            latestSeri.TemplateName = syncItem.TemplateName;
            latestSeri.BranchId = syncItem.BranchId;

            List<SyncVersion> latestVersions = syncItem.GetLatestVersions().ToList();
            foreach (var ver in latestVersions)
            {
                ver.Revision = "1";
                ver.Version = "1";
                var fieldsToExclude = ver.Fields.Where(n => n.FieldName.StartsWith("__")).ToList();
                foreach (var fieldToExclude in fieldsToExclude)
                {
                    ver.RemoveField(fieldToExclude.FieldName);
                }

                latestSeri.Versions.Add(ver);
            }
            return latestSeri;
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