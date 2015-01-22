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
            StringBuilder sb = new StringBuilder();
            using (var writer = new StringWriter(sb))
            {
                syncItem.Serialize(writer);
            }

            var dto = new ItemDto
            {
                Item = syncItem,
                Raw = sb.ToString(),
                Hash = HashUtil.Md5Hash(sb.ToString())
            };

            var jsSerializer = new JavaScriptSerializer();
            string content = jsSerializer.Serialize(dto);

            response.ContentType = "application/json";
            response.Write(content);
        }

        public static void WriteJson(this HttpResponse response, object obj, bool includeHashHeader = false)
        {
            var jsSerializer = new JavaScriptSerializer();
            string content = jsSerializer.Serialize(obj);

            if (includeHashHeader)
            {
                response.Headers["X-Content-Hash"] = HashUtil.Md5Hash(content);
            }

            response.ContentType = "application/json";
            response.Write(content);
        }
    }
}