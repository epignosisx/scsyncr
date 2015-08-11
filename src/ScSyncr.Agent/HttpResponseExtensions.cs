using System.IO;
using System.Text;
using System.Web;
using System.Web.Script.Serialization;
using Sitecore.Data.Serialization.ObjectModel;

namespace ScSyncr.Agent
{
    internal static class HttpResponseExtensions
    {
        public static void WriteSyncItem(this HttpResponse response, SyncItem syncItem, SyncItem latestSyncItem)
        {
            StringBuilder sb = Utils.SerializeSyncItem(syncItem);
            string rawValue = sb.ToString();
            sb.Clear();
            string latestValue = Utils.SerializeSyncItem(latestSyncItem, sb).ToString();
            var dto = new ItemDto
            {
                Item = syncItem,
                Raw = rawValue,
                Hash = Utils.Md5Hash(rawValue),
                LatestVersionRaw = latestValue,
                LatestVersionHash = Utils.Md5Hash(latestValue)
            };

            var jsSerializer = new JavaScriptSerializer();
            jsSerializer.MaxJsonLength = int.MaxValue;
            string content = jsSerializer.Serialize(dto);

            response.ContentType = "application/json";
            response.Write(content);
        }

        public static void WriteJson(this HttpResponse response, object obj)
        {
            var jsSerializer = new JavaScriptSerializer();
            jsSerializer.MaxJsonLength = int.MaxValue;
            string content = jsSerializer.Serialize(obj);
            response.ContentType = "application/json";
            response.Write(content);
        }
    }
}