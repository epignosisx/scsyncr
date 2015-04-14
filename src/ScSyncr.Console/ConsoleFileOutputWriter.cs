using System;

namespace ScSyncr.Console
{
    public class ConsoleFileOutputWriter : IOutputWriter, IDisposable
    {
        private readonly FileOutputWriter _fileWriter;
        private readonly ConsoleOutputWriter _consoleWriter;

        public ConsoleFileOutputWriter(string filePath)
        {
            _fileWriter = new FileOutputWriter(filePath);
            _consoleWriter = new ConsoleOutputWriter();
        }

        public void Write(string message, params object[] args)
        {
            _consoleWriter.Write(message, args);
            _fileWriter.Write(message, args);
        }

        public void Dispose()
        {
            Dispose(true);
            GC.SuppressFinalize(this);
        }

        ~ConsoleFileOutputWriter()
        {
            Dispose(false);
        }

        protected virtual void Dispose(bool disposing)
        {
            // release unmanaged memory
            if (disposing)
            {   
                // release other disposable objects
                if (_fileWriter != null)
                {
                    _fileWriter.Dispose();
                }
            }
        }
    }
}