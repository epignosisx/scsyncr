using System;
using System.IO;

namespace ScSyncr.Console
{
    public class FileOutputWriter : IOutputWriter, IDisposable
    {
        private StreamWriter _writer;

        public FileOutputWriter(string filePath)
        {
            _writer = new StreamWriter(filePath, true);
        }

        public void Write(string message, params object[] args)
        {
            _writer.Write(message, args);
        }

        public void Dispose()
        {
            Dispose(true);
            GC.SuppressFinalize(this);
        }

        ~FileOutputWriter()
        {
            Dispose(false);
        }

        protected virtual void Dispose(bool disposing)
        {
            // release unmanaged memory
            if (disposing)
            {   
                // release other disposable objects
                if (_writer != null)
                {
                    _writer.Dispose();
                    _writer = null;
                }
            }
        }
    }
}