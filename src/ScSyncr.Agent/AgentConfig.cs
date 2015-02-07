using System;
using System.Configuration;

namespace ScSyncr.Agent
{
    public static class AgentConfig
    {
        public static bool RecycleInsteadOfDelete {
            get { return string.Equals(ConfigurationManager.AppSettings["ScSyncr:RecycleInsteadOfDelete"], "true", StringComparison.OrdinalIgnoreCase); }
        }
    }
}
