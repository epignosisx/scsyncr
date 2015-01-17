using Microsoft.Owin;
using Owin;

[assembly: OwinStartupAttribute(typeof(TreeView.Web.Startup))]
namespace TreeView.Web
{
    public partial class Startup
    {
        public void Configuration(IAppBuilder app)
        {
            ConfigureAuth(app);
        }
    }
}
