using System.Web;
using System.Web.Routing;

namespace ScSyncr.Agent
{
    public class CmsVisualizerHttpModule : IHttpModule
    {
        public void Init(HttpApplication context)
        {
            if (!RouteTable.Routes.Contains(CmsVisualizerRoute.Singleton))
                RouteTable.Routes.Add(CmsVisualizerRoute.Singleton);
            //context.BeginRequest += BeginRequest;
        }

        public void Dispose()
        {
        }
    }
}
