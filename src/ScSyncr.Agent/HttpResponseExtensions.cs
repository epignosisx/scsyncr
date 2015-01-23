using System.IO;
using System.Text;
using System.Web;
using System.Web.Script.Serialization;
using Sitecore.Data.Serialization.ObjectModel;

namespace ScSyncr.Agent
{
    internal static class HttpResponseExtensions
    {
        public static void WriteSyncItem(this HttpResponse response, SyncItem syncItem)
        {
            StringBuilder sb = Utils.SerializeSyncItem(syncItem);
            string value = sb.ToString();
            var dto = new ItemDto
            {
                Item = syncItem,
                Raw = value,
                Hash = Utils.Md5Hash(value)
            };

            var jsSerializer = new JavaScriptSerializer();
            string content = jsSerializer.Serialize(dto);

            response.ContentType = "application/json";
            response.Write(content);
        }

        public static void WriteJson(this HttpResponse response, object obj)
        {
            var jsSerializer = new JavaScriptSerializer();
            string content = jsSerializer.Serialize(obj);
            response.ContentType = "application/json";
            response.Write(content);
        }
    }
}