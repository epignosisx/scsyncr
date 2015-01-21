using System.Web;

namespace ScSyncr.Agent
{
    internal interface ICommandHandler
    {
        void Handle(HttpContext context);
    }
}