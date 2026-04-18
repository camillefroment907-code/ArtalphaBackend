"""
Blog API — market intelligence articles.

Public:
  GET /api/blog              — list published posts (paginated)
  GET /api/blog/:slug        — single post by slug

Admin:
  POST   /api/blog           — create post
  PATCH  /api/blog/:slug     — update post
  DELETE /api/blog/:slug     — delete post
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import re

from app.database import get_db
from app.models.db_models import BlogPost
from app.api.admin import verify_admin

router = APIRouter(prefix="/blog", tags=["blog"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class BlogPostCreate(BaseModel):
    slug:              Optional[str]  = None   # auto-generated from title if not provided
    title:             str
    excerpt:           Optional[str]  = None
    content:           str
    cover_image:       Optional[str]  = None
    author:            Optional[str]  = "Nautilus Editorial"
    tags:              Optional[List[str]] = []
    is_published:      Optional[bool] = False
    read_time_minutes: Optional[int]  = 5


class BlogPostUpdate(BaseModel):
    title:             Optional[str]  = None
    excerpt:           Optional[str]  = None
    content:           Optional[str]  = None
    cover_image:       Optional[str]  = None
    author:            Optional[str]  = None
    tags:              Optional[List[str]] = None
    is_published:      Optional[bool] = None
    read_time_minutes: Optional[int]  = None


def _slugify(title: str) -> str:
    slug = title.lower()
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[\s_-]+', '-', slug)
    slug = slug.strip('-')[:200]
    return slug


def _serialize(post: BlogPost) -> dict:
    return {
        "id":                str(post.id),
        "slug":              post.slug,
        "title":             post.title,
        "excerpt":           post.excerpt,
        "content":           post.content,
        "cover_image":       post.cover_image,
        "author":            post.author,
        "tags":              post.tags or [],
        "is_published":      post.is_published,
        "published_at":      post.published_at.isoformat() if post.published_at else None,
        "read_time_minutes": post.read_time_minutes,
        "created_at":        post.created_at.isoformat(),
        "updated_at":        post.updated_at.isoformat() if post.updated_at else None,
    }


def _serialize_list(post: BlogPost) -> dict:
    """Light serialization for list view (no full content)."""
    d = _serialize(post)
    d.pop("content")
    return d


# ── Public endpoints ──────────────────────────────────────────────────────────

@router.get("")
async def list_posts(
    page:     int   = Query(default=1, ge=1),
    per_page: int   = Query(default=12, le=50),
    tag:      Optional[str] = None,
    db:       AsyncSession = Depends(get_db),
):
    filters = [BlogPost.is_published == True]  # noqa: E712
    if tag:
        filters.append(BlogPost.tags.any(tag))

    from sqlalchemy import and_
    total = (await db.execute(select(func.count(BlogPost.id)).where(and_(*filters)))).scalar() or 0

    result = await db.execute(
        select(BlogPost)
        .where(and_(*filters))
        .order_by(desc(BlogPost.published_at))
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    posts = result.scalars().all()

    return {
        "posts":    [_serialize_list(p) for p in posts],
        "total":    total,
        "page":     page,
        "per_page": per_page,
        "pages":    (total + per_page - 1) // per_page,
    }


@router.get("/{slug}")
async def get_post(slug: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(BlogPost).where(BlogPost.slug == slug, BlogPost.is_published == True)  # noqa: E712
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return _serialize(post)


# ── Admin endpoints ───────────────────────────────────────────────────────────

@router.post("", status_code=201)
async def create_post(
    body: BlogPostCreate,
    db:   AsyncSession = Depends(get_db),
    _:    bool         = Depends(verify_admin),
):
    slug = body.slug or _slugify(body.title)
    # Ensure slug uniqueness
    existing = (await db.execute(select(BlogPost).where(BlogPost.slug == slug))).scalar_one_or_none()
    if existing:
        slug = f"{slug}-{int(datetime.utcnow().timestamp())}"

    post = BlogPost(
        slug=slug,
        title=body.title,
        excerpt=body.excerpt,
        content=body.content,
        cover_image=body.cover_image,
        author=body.author or "Nautilus Editorial",
        tags=body.tags or [],
        is_published=body.is_published or False,
        published_at=datetime.utcnow() if body.is_published else None,
        read_time_minutes=body.read_time_minutes or 5,
    )
    db.add(post)
    await db.commit()
    await db.refresh(post)
    return _serialize(post)


@router.patch("/{slug}")
async def update_post(
    slug: str,
    body: BlogPostUpdate,
    db:   AsyncSession = Depends(get_db),
    _:    bool         = Depends(verify_admin),
):
    result = await db.execute(select(BlogPost).where(BlogPost.slug == slug))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    updates = body.model_dump(exclude_none=True)
    # If publishing for the first time, set published_at
    if updates.get("is_published") and not post.published_at:
        post.published_at = datetime.utcnow()
    for field, value in updates.items():
        setattr(post, field, value)
    post.updated_at = datetime.utcnow()
    await db.commit()
    return _serialize(post)


@router.delete("/{slug}", status_code=204)
async def delete_post(
    slug: str,
    db:   AsyncSession = Depends(get_db),
    _:    bool         = Depends(verify_admin),
):
    result = await db.execute(select(BlogPost).where(BlogPost.slug == slug))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    await db.delete(post)
    await db.commit()
