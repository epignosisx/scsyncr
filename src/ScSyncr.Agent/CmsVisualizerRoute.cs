using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
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

        private CmsVisualizerRoute() : base("cmsvis/{command}", new CmsVisualizerRouteHandler())
        {
        }
    }
}
