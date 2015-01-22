using System.Web.Routing;

namespace ScSyncr.Agent
{
    public class CmsVisualizerRoute : Route
    {
        private static readonly CmsVisualizerRoute singleton = new CmsVisualizerRoute();

        public static CmsVisualizerRoute Singleton
        {
            get { return singleton; }
        }

        private CmsVisualizerRoute() : base("scsyncr/{command}", new CmsVisualizerRouteHandler())
        {
        }
    }
}
