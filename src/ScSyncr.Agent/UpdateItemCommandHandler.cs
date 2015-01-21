using System;
using System.Web;
using System.Web.Script.Serialization;
using Sitecore.Data.Serialization;
using Sitecore.Data.Serialization.ObjectModel;
using Sitecore.WordOCX.Extensions;
using Web.UI.XamlSharp.Xaml.Attributes;

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
                context.Response.WriteLine("Expected Content Type: application/json, but received: " + request.ContentType);
                return;
            }

            request.InputStream.Position = 0;//reset the stream so we can read the content
            byte[] rawBody = request.BinaryRead(request.ContentLength);
            string postBody = request.ContentEncoding.GetString(rawBody);

            JavaScriptSerializer serializer = new JavaScriptSerializer();
            SyncItem item = serializer.Deserialize<SyncItem>(postBody);
            ItemSynchronization.PasteSyncItem(item, new LoadOptions());
        }
    }
}