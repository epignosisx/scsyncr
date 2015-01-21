using System.Web;
using System.Web.Routing;

namespace ScSyncr.Agent
{
    public class CmsVisualizerRouteHandler : IRouteHandler
    {
        public IHttpHandler GetHttpHandler(RequestContext requestContext)
        {
            return new CmsVisualizerHttpHandler(requestContext);
        }
    }
}