﻿using System;
using System.Globalization;
using System.IO;
using System.Reflection;
using ScSyncr.Console.CommandLine;

namespace ScSyncr.Console
{
    class Program
    {
        static int Main(string[] args)
        {
            var app = new CommandLineApplication(throwOnUnexpectedArg: false);
            app.Name = "ScSyncr";
            app.FullName = app.Name;
            app.Description = "Compares & Syncs Sitecore instances";
            app.HelpOption("-?|-h|--help");
            app.VersionOption("--version", GetVersion);

            string dateFormat = CultureInfo.InvariantCulture.DateTimeFormat.SortableDateTimePattern.Replace("'", "");
            CommandOption sourceOption = app.Option("--source <SOURCE_URL>", "Sitecore Source Url", CommandOptionType.SingleValue);
            CommandOption targetOption = app.Option("--target <TARGET_URL>", "Sitecore Target Url", CommandOptionType.SingleValue);
            CommandOption databaseOption = app.Option("--db <DATABASE_NAME>", "Sitecore Database name", CommandOptionType.SingleValue);
            CommandOption fromDateOption = app.Option("--from <FROM_DATE>", "Use Format: " + dateFormat, CommandOptionType.SingleValue);
            CommandOption toDateOption = app.Option("--to <TO_DATE>", "Use Format: " + dateFormat, CommandOptionType.SingleValue);
            CommandOption hoursOption = app.Option("--hours <HOURS>", "Hours to go back in history from now", CommandOptionType.SingleValue);
            CommandOption syncOption = app.Option("--sync", "Syncs source changes to target (optional)", CommandOptionType.NoValue);
            CommandOption verboseOption = app.Option("--verbose", "See detailed output (optional)", CommandOptionType.NoValue);
            CommandOption outputOption = app.Option("--output <OUTPUT_FILE>", "Output file (optional)", CommandOptionType.SingleValue);

            // Show help information if no subcommand/option was specified
            app.OnExecute(() =>
            {
                app.ShowHelp();
                return 2;
            });

            app.Command("compare", c =>
            {
                c.Description = "Compare sitecore instances without synching differences";
                c.OnExecute(() =>
                {
                    CompareOptions options;
                    if(CompareOptions.TryParse(
                        databaseOption.Value(), sourceOption.Value(), targetOption.Value(), 
                        fromDateOption.Value(), toDateOption.Value(), hoursOption.Value(),
                        syncOption.HasValue(), verboseOption.HasValue(), out options))
                    {
                        using (var writer = GetOutputWriter(outputOption.Value()))
                        {
                            var command = new CompareCommand(writer);
                            var result = command.Execute(options);
                            return result;
                        }
                    }
                    return -1;
                });

            }, addHelpCommand: false);

            int exitCode = app.Execute(args);
            return exitCode;
        }

        private static string GetVersion()
        {
            var assembly = typeof(Program).GetTypeInfo().Assembly;
            var assemblyInformationalVersionAttribute = assembly.GetCustomAttribute<AssemblyFileVersionAttribute>();
            return assemblyInformationalVersionAttribute.Version;
        }

        private static IOutputWriter GetOutputWriter(string outputFilePath)
        {
            if(string.IsNullOrEmpty(outputFilePath))
                return new ConsoleOutputWriter();

            string dir = Path.GetDirectoryName(outputFilePath);

            if (string.IsNullOrEmpty(dir))
            {
                outputFilePath = Path.Combine(Environment.CurrentDirectory, outputFilePath);
            }
            else
            {
                Directory.CreateDirectory(dir);
            }

            System.Console.WriteLine("Writing output to: " + outputFilePath);
            return new ConsoleFileOutputWriter(outputFilePath);
        }
    }
}
