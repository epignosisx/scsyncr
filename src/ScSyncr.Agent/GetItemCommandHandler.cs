using System;
using System.Linq;
using System.Collections.Generic;
using System.Web;
using Sitecore.Data;
using Sitecore.Data.Items;
using Sitecore.Data.Serialization.ObjectModel;
using Sitecore.Resources;
using Sitecore.SecurityModel;

namespace ScSyncr.Agent
{
    internal class GetItemCommandHandler : ICommandHandler
    {
        public void Handle(HttpContext context)
        {
            string database = context.Request.QueryString[ParameterKeys.Db];
            string id = context.Request.QueryString[ParameterKeys.ItemId];

            using (new SecurityDisabler())
            {
                var db = Sitecore.Configuration.Factory.GetDatabase(database);
                Item item = db.GetItem(new ID(id));
                if (item == null)
                {
                    context.Response.TrySkipIisCustomErrors = true;
                    context.Response.StatusCode = 404;
                    context.Response.StatusDescription = "Item not found";
                    context.Response.Write("Item not found");
                    return;
                }

                SyncItem seri = Sitecore.Data.Serialization.ItemSynchronization.BuildSyncItem(item);
                SyncItem latestSeri = Utils.GetLatestVersions(seri);
                context.Response.WriteSyncItem(seri, latestSeri);
            }
        }
    }

    internal class TreeItemDto
    {
        public Guid Id { get; set; }
        public Guid ParentId { get; set; }
        public string Name { get; set; }
        public List<TreeItemDto> Children { get; set; }
        public string Hash { get; set; }
        public string LatestVersionHash { get; set; }
        public string Icon { get; set; }
    }

    internal class ItemDto
    {
        public SyncItem Item { get; set; }
        public string Raw { get; set; }
        public string Hash { get; set; }

        public string LatestVersionRaw { get; set; }
        public string LatestVersionHash { get; set; }
    }

    internal static class ItemExtensions
    {
        public static TreeItemDto MapToTreeItemDto(this Item item, string hash, string latestVersionHash, string host)
        {
            var dto = new TreeItemDto();
            dto.Id = item.ID.Guid;
            dto.Name = item.Name;
            dto.ParentId = item.ParentID.Guid;
            dto.Hash = hash;
            dto.LatestVersionHash = latestVersionHash;
            dto.Icon = host + Images.GetThemedImageSource(item.Appearance.Icon);
            return dto;
        }

        //public static ItemDto MapToDto(this Item item)
        //{
        //    var dto = new ItemDto();
        //    dto.Id = item.ID.Guid;
        //    dto.Name = item.Name;
        //    dto.ParentId = item.ParentID.Guid;
        //    dto.TemplateId = item.TemplateID.Guid;
        //    dto.BranchId = item.BranchId.Guid;
        //    dto.Database = item.Database.Name;
        //    dto.Path = item.Paths.FullPath;
        //    dto.Version = item.Version.Number;
        //    dto.Fields = new List<FieldDto>();
            
        //    foreach (Field field in item.Fields)
        //    {
        //        var fieldDto = field.MapToDto();
        //        dto.Fields.Add(fieldDto);
        //    }

        //    return dto;
        //}

        //public static FieldDto MapToDto(this Field field)
        //{
        //    var dto = new FieldDto();
        //    dto.Id = field.ID.Guid;
        //    dto.Name = field.Name;
        //    dto.Language = field.Language.Name;
        //    dto.Value = field.Value;

        //    return dto;
        //}
    }
}