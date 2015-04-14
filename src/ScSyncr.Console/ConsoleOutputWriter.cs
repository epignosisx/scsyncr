namespace ScSyncr.Console
{
    public class ConsoleOutputWriter : IOutputWriter
    {
        public void Write(string message, params object[] args)
        {
            System.Console.Write(message, args);
        }

        public void Dispose()
        {
        }
    }
}