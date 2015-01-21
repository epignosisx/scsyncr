using System.Web;
using ScSyncr.Agent;

[assembly: PreApplicationStartMethod(typeof(PreApplicationStart), "Start")]

namespace ScSyncr.Agent
{
    public class PreApplicationStart
    {
        public static void Start()
        {
            Microsoft.Web.Infrastructure.DynamicModuleHelper.DynamicModuleUtility.RegisterModule(typeof(CmsVisualizerHttpModule));
        }
    }
}
