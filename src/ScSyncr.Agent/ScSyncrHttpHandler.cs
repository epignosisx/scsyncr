using System;
using System.Collections;
using System.Collections.Generic;
using System.Web;
using System.Web.Routing;

namespace ScSyncr.Agent
{
    public class ScSyncrHttpHandler : IHttpHandler
    {
        private readonly static Dictionary<string, ICommandHandler> Routes = new Dictionary<string, ICommandHandler>(StringComparer.OrdinalIgnoreCase)
        {
            { "get-item", new GetItemCommandHandler() },
            { "get-tree-item", new GetTreeItemCommandHandler() },
            { "update-item", new UpdateItemCommandHandler() }
        };

        private readonly RequestContext _requestContext;

        public ScSyncrHttpHandler(RequestContext requestContext)
        {
            _requestContext = requestContext;
        }
        
        public void ProcessRequest(HttpContext context)
        {
            try
            {
                if (_requestContext.HttpContext.Request.HttpMethod != "OPTIONS")
                {
                    string command = _requestContext.RouteData.Values["command"] as string;
                    ICommandHandler handler;
                    if (command != null && Routes.TryGetValue(command, out handler))
                    {
                        try
                        {
                            handler.Handle(context);
                        }
                        catch (Exception ex)
                        {
                            context.Response.TrySkipIisCustomErrors = true;
                            context.Response.StatusCode = 500;
                            context.Response.Write(ex.ToString());
                        }
                    }
                    else
                    {
                        context.Response.StatusCode = 404;
                        context.Response.Write("Unknown command");
                    }                    
                }
            }
            finally
            {
                context.Response.Headers["Access-Control-Allow-Origin"] = "*";
                context.Response.Headers["Access-Control-Allow-Methods"] = "GET,PUT,POST,DELETE";
                if (context.Request.Headers["Access-Control-Request-Headers"] != null)
                    context.Response.Headers["Access-Control-Allow-Headers"] = context.Request.Headers["Access-Control-Request-Headers"];
                context.Response.Headers["Access-Control-Max-Age"] = "1800";
            }
        }

        public bool IsReusable 
        {
            get { return true; }
        }
    }
}