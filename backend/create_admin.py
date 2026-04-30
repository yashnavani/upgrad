#!/usr/bin/env python3
"""
Quick script to create an admin user directly in the database.
Run: docker exec mf-backend python create_admin.py
"""
import asyncio
import sys
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.user import User
from app.core.auth_service import get_password_hash


async def create_admin_user(
    email: str = "admin@example.com",
    password: str = "admin123",
    full_name: str = "Admin User",
):
    """Create an admin user with superuser privileges."""
    async with AsyncSessionLocal() as db:
        # Check if user already exists
        result = await db.execute(select(User).where(User.email == email))
        existing = result.scalar_one_or_none()
        
        if existing:
            print(f"⚠️  User with email {email} already exists!")
            # Update password and superuser status
            existing.hashed_password = get_password_hash(password)
            existing.is_superuser = True
            existing.is_active = True
            await db.commit()
            print(f"✅ Updated {email}:")
            print(f"   - Password reset to: {password}")
            print(f"   - Superuser: True")
            print(f"   - Active: True")
            return
        
        # Create new admin user
        user = User(
            email=email,
            full_name=full_name,
            hashed_password=get_password_hash(password),
            is_active=True,
            is_superuser=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        
        print(f"✅ Admin user created successfully!")
        print(f"   Email: {email}")
        print(f"   Password: {password}")
        print(f"   Superuser: {user.is_superuser}")
        print(f"\n✅ Open the app at http://localhost:3001 and go to /interview (no login screen; API uses this user as the system actor).")


if __name__ == "__main__":
    email = sys.argv[1] if len(sys.argv) > 1 else "admin@example.com"
    password = sys.argv[2] if len(sys.argv) > 2 else "admin123"
    full_name = sys.argv[3] if len(sys.argv) > 3 else "Admin User"
    
    asyncio.run(create_admin_user(email, password, full_name))
