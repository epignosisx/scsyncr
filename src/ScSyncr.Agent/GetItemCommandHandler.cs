using System;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Web;
using System.Web.Script.Serialization;
using Sitecore.Collections;
using Sitecore.Data;
using Sitecore.Data.Fields;
using Sitecore.Data.Items;
using Sitecore.Data.Query;
using Sitecore.Data.Serialization.ObjectModel;
using Sitecore.SecurityModel;

namespace ScSyncr.Agent
{
    internal static class ParameterKeys
    {
        internal static readonly string Db = "db";
        internal static readonly string ItemId = "itemId";
    }

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

                SyncItem seri = Sitecore.Data.Serialization.ItemSynchronization.BuildSyncItem(item);
                context.Response.WriteJson(seri, true);
            }
        }
    }

    internal class GetTreeItemCommandHandler : ICommandHandler
    {
        public void Handle(HttpContext context)
        {
            string database = context.Request.QueryString[ParameterKeys.Db];
            string id = context.Request.QueryString[ParameterKeys.ItemId];

            using (new SecurityDisabler())
            {
                var db = Sitecore.Configuration.Factory.GetDatabase(database);
                Item item = db.GetItem(new ID(id));

                var dto = item.MapToTreeItemDto();
                dto.Children = new List<TreeItemDto>();
                foreach (Item child in item.GetChildren())
                {
                    dto.Children.Add(child.MapToTreeItemDto());
                }
                context.Response.WriteJson(dto);
            }
        }
    }

    internal static class HttpResponseExtensions
    {
        private static readonly JavaScriptSerializer Serializer = new JavaScriptSerializer();

        public static void WriteJson(this HttpResponse response, object obj, bool includeHashHeader = false)
        {
            string content = Serializer.Serialize(obj);

            if (includeHashHeader)
            {
                MD5 md5 = new MD5CryptoServiceProvider();
                byte[] hash = md5.ComputeHash(System.Text.Encoding.UTF8.GetBytes(content));
                response.Headers["X-Content-Hash"] = Convert.ToBase64String(hash);
            }
            
            response.Write(content);
            response.ContentType = "application/json";
        }
    }

    internal class TreeItemDto
    {
        public Guid Id { get; set; }
        public Guid ParentId { get; set; }
        public string Name { get; set; }
        public List<TreeItemDto> Children { get; set; }
    }

    internal class ItemDto
    {
        public SyncItem Item { get; set; }
        public string Md5 { get; set; }

        //public Guid Id { get; set; }
        //public string Name { get; set; }
        //public Guid ParentId { get; set; }
        //public Guid TemplateId { get; set; }
        //public Guid BranchId { get; set; }
        //public string Database { get; set; }
        //public List<FieldDto> Fields { get; set; }
        //public string Path { get; set; }
        //public int Version { get; set; }
    }

    //internal class FieldDto
    //{
    //    public Guid Id { get; set; }
    //    public string Name { get; set; }
    //    public string Language { get; set; }
    //    public string Value { get; set; }
    //}



    internal static class ItemExtensions
    {
        public static TreeItemDto MapToTreeItemDto(this Item item)
        {
            var dto = new TreeItemDto();
            dto.Id = item.ID.Guid;
            dto.Name = item.Name;
            dto.ParentId = item.ParentID.Guid;
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