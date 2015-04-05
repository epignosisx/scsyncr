using System;

namespace ScSyncr.Console
{
    internal class ColorSwitcher : IDisposable
    {
        public ColorSwitcher(ConsoleColor color)
        {
            System.Console.ForegroundColor = color;
        }

        public void Dispose()
        {
            System.Console.ResetColor();
        }
    }
}