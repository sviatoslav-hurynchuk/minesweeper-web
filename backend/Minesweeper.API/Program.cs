using Microsoft.EntityFrameworkCore;
using Minesweeper.API.Data;
using Minesweeper.API.Models;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(connectionString));

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddOpenApi();
builder.Services.AddSignalR();

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi(); 
    app.MapScalarApiReference();
}

app.UseHttpsRedirection();
app.UseCors();

app.MapPost("/api/auth/guest", async (AppDbContext db, GuestRequest request) =>
{
    var finalUsername = string.IsNullOrWhiteSpace(request.Username)
        ? $"Guest_{Random.Shared.Next(1000, 9999)}"
        : request.Username;

    var isNameTaken = await db.Users.AnyAsync(u => u.Username == finalUsername);
    if (isNameTaken)
    {
        return Results.Conflict(new { Message = "This username is already taken." });
    }

    var user = new User
    {
        Username = finalUsername,
        IsGuest = true
    };

    db.Users.Add(user);
    await db.SaveChangesAsync();

    return Results.Ok(new
    {
        user.Id,
        user.Username,
        user.IsGuest
    });
})
.WithName("CreateGuestUser");

app.MapHub<Minesweeper.API.Hubs.GameHub>("/gamehub");

app.Run();

public record GuestRequest(string? Username);