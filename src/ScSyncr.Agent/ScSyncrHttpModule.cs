using System.Web;
using System.Web.Routing;

namespace ScSyncr.Agent
{
    public class ScSyncrHttpModule : IHttpModule
    {
        public void Init(HttpApplication context)
        {
            if (!RouteTable.Routes.Contains(ScSyncrRoute.Singleton))
                RouteTable.Routes.Add(ScSyncrRoute.Singleton);
            //context.BeginRequest += BeginRequest;
        }

        public void Dispose()
        {
        }
    }
}
