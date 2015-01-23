using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using Sitecore.Data.Serialization.ObjectModel;

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
    }
}