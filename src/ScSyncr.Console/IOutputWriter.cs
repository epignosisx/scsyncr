using System;

namespace ScSyncr.Console
{
    public interface IOutputWriter : IDisposable
    {
        void Write(string message, params object[] args);
    }
}
