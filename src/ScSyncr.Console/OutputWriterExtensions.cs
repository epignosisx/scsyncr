using System;

namespace ScSyncr.Console
{
    public static class OutputWriterExtensions
    {
        public static void WriteLine(this IOutputWriter writer, string message, params object[] args)
        {
            writer.Write(message + Environment.NewLine, args);
        }

        public static void WriteErrorLine(this IOutputWriter writer, string message, params object[] args)
        {
            using(new ColorSwitcher(ConsoleColor.Red))
                writer.Write(message + Environment.NewLine, args);
        }
    }
}