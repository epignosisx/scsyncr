using System;
using System.Security.Cryptography;

namespace ScSyncr.Agent
{
    public static class HashUtil
    {
        public static string Md5Hash(string content)
        {
            MD5 md5 = new MD5CryptoServiceProvider();
            byte[] hash = md5.ComputeHash(System.Text.Encoding.UTF8.GetBytes(content));
            return Convert.ToBase64String(hash);
        }
    }
}