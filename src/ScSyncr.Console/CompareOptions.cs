using System;
using System.Globalization;

namespace ScSyncr.Console
{
    internal class CompareOptions
    {
        public string Database { get; private set; }
        public Uri SourceUrl { get; private set; }
        public Uri TargetUrl { get; private set; }
        public DateTime From { get; private set; }
        public DateTime To { get; private set; }
        public bool Verbose { get; private set; }
        public bool Sync { get; private set; }

        private CompareOptions()
        {
        }

        public static bool TryParse(string database, string sourceUrl, string targetUrl, string from, string to, string hours, bool sync, bool verbose, out CompareOptions options)
        {
            options = new CompareOptions();
            options.Sync = sync;
            options.Verbose = verbose;
            if (!string.IsNullOrWhiteSpace(database))
            {
                options.Database = database;
            }
            else
            {
                using (new ColorSwitcher(ConsoleColor.Red))
                    System.Console.Error.WriteLine("Database was not specified");
                return false;
            }

            Uri url;
            if (Uri.TryCreate(sourceUrl, UriKind.Absolute, out url))
            {
                options.SourceUrl = url;
            }
            else
            {
                using (new ColorSwitcher(ConsoleColor.Red))
                    System.Console.Error.WriteLine("Source Url is not valid: {0}", sourceUrl);
                return false;
            }

            if (Uri.TryCreate(targetUrl, UriKind.Absolute, out url))
            {
                options.TargetUrl = url;
            }
            else
            {
                using (new ColorSwitcher(ConsoleColor.Red))
                    System.Console.Error.WriteLine("Target Url is not valid: {0}", targetUrl);
                return false;
            }

            double theHours;
            if (!string.IsNullOrWhiteSpace(hours))
            {
                if (double.TryParse(hours, out theHours))
                {
                    options.From = DateTime.Now.AddHours(-theHours);
                    options.To = DateTime.Now;
                }
                else
                {
                    using (new ColorSwitcher(ConsoleColor.Red))
                        System.Console.Error.WriteLine("Hours is not valid: {0}", from);
                    return false;
                }
            }
            else
            {
                DateTime date;
                if (DateTime.TryParseExact(from, "s", CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out date))
                {
                    options.From = date;
                }
                else
                {
                    using (new ColorSwitcher(ConsoleColor.Red))
                        System.Console.Error.WriteLine("From Date is not valid: {0}", from);
                    return false;
                }

                if (DateTime.TryParseExact(to, "s", CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out date))
                {
                    options.To = date;
                }
                else
                {
                    using (new ColorSwitcher(ConsoleColor.Red))
                        System.Console.Error.WriteLine("To Date is not valid: {0}", to);
                    return false;
                }    
            }

            return true;
        }

        public override string ToString()
        {
            return "Source: " + SourceUrl + 
                   ", Target: " + TargetUrl + 
                   ", Database: " + Database + 
                   ", From: " + From.ToString("s") + 
                   ", To: " + To.ToString("s");
        }
    }
}