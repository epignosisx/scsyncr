using System.Web.Routing;

namespace ScSyncr.Agent
{
    public class ScSyncrRoute : Route
    {
        private static readonly ScSyncrRoute singleton = new ScSyncrRoute();

        public static ScSyncrRoute Singleton
        {
            get { return singleton; }
        }

        private ScSyncrRoute() : base("scsyncr/{command}", new ScSyncrRouteHandler())
        {
        }
    }
}
