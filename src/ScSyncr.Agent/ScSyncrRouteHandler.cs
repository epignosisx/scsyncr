using System.Web;
using System.Web.Routing;

namespace ScSyncr.Agent
{
    public class ScSyncrRouteHandler : IRouteHandler
    {
        public IHttpHandler GetHttpHandler(RequestContext requestContext)
        {
            return new ScSyncrHttpHandler(requestContext);
        }
    }
}