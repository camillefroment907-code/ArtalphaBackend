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
    lang:              Optional[str]  = "fr"
    translations:      Optional[dict] = None


class BlogPostUpdate(BaseModel):
    title:             Optional[str]  = None
    excerpt:           Optional[str]  = None
    content:           Optional[str]  = None
    cover_image:       Optional[str]  = None
    author:            Optional[str]  = None
    tags:              Optional[List[str]] = None
    is_published:      Optional[bool] = None
    read_time_minutes: Optional[int]  = None
    lang:              Optional[str]  = None
    translations:      Optional[dict] = None


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
        "lang":              getattr(post, "lang", "fr") or "fr",
        "translations":      getattr(post, "translations", None) or {},
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
        lang=body.lang or "fr",
        translations=body.translations or {},
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


# ── Auto-generation (GPT-4o) ──────────────────────────────────────────────────

_GENERATE_PROMPTS = {
    "weekly_opportunities": (
        "You are a senior art market analyst writing for Nautilus, a premium art investment platform. "
        "Write a 600-word editorial blog post titled '5 Exceptional Art Investment Opportunities This Week'. "
        "Tone: authoritative, data-driven, premium. Style: editorial, not promotional. "
        "Include: introduction on market conditions, 5 short opportunity summaries (artist name, medium, estimated value range, why it's interesting), closing insight. "
        "Format as clean HTML paragraphs — no markdown, no headers using markdown syntax. "
        "Use <h3> for section headers, <p> for paragraphs."
    ),
    "artist_spotlight": (
        "You are a senior art market analyst writing for Nautilus, a premium art investment platform. "
        "Write a 500-word editorial blog post about an 'Artist to Watch' for 2026. "
        "Choose a contemporary artist with genuine momentum (e.g. Anna Weyant, Jadé Fadojutimi, Issy Wood, Loie Hollowell). "
        "Cover: biography highlights, market trajectory, recent auction results, why now is the right moment. "
        "Format as clean HTML. Use <h3> for section headers."
    ),
    "market_outlook": (
        "You are a senior art market analyst writing for Nautilus, a premium art investment platform. "
        "Write a 600-word article titled 'The Art Market in 2026: What Every Investor Needs to Know'. "
        "Cover: post-pandemic market recovery, which segments are performing (contemporary vs modern vs old masters), "
        "where smart money is moving, key risks and opportunities. "
        "Format as clean HTML. Use <h3> for section headers."
    ),
    "methodology": (
        "You are a senior art market analyst writing for Nautilus, a premium art investment platform. "
        "Write a 700-word educational article titled 'How Nautilus Identifies Undervalued Art Before the Market'. "
        "Explain: the deal scoring methodology (0-100 scale), data sources (30+ auction houses), "
        "how AI detects pricing anomalies, what a score of 65+ means, and why having this edge matters for investors. "
        "Tone: educational, authoritative. Format as clean HTML. Use <h3> for section headers."
    ),
}

_LAUNCH_POSTS = [
    {
        "type": "weekly_opportunities",
        "title": "5 Exceptional Art Investment Opportunities This Week",
        "slug": "5-exceptional-art-investment-opportunities-this-week",
        "tags": ["opportunities", "weekly", "deals"],
        "read_time_minutes": 4,
    },
    {
        "type": "artist_spotlight",
        "title": "Artist to Watch in 2026: Anna Weyant",
        "slug": "artist-to-watch-2026-anna-weyant",
        "tags": ["artist", "contemporary", "momentum"],
        "read_time_minutes": 3,
    },
    {
        "type": "methodology",
        "title": "How Nautilus Identifies Undervalued Art Before the Market",
        "slug": "how-nautilus-identifies-undervalued-art",
        "tags": ["methodology", "education", "deal-score"],
        "read_time_minutes": 5,
    },
    {
        "type": "market_outlook",
        "title": "The Art Market in 2026: What Every Investor Needs to Know",
        "slug": "art-market-2026-investor-guide",
        "tags": ["market", "2026", "outlook"],
        "read_time_minutes": 4,
    },
]


@router.post("/generate")
async def generate_blog_post(
    body: dict,
    db:   AsyncSession = Depends(get_db),
    _:    bool         = Depends(verify_admin),
):
    """
    Generate a blog post using GPT-4o and publish it.
    Body: { "type": "weekly_opportunities" | "artist_spotlight" | "market_outlook" | "methodology" }
    """
    import os
    from openai import AsyncOpenAI

    post_type = body.get("type", "weekly_opportunities")
    prompt = _GENERATE_PROMPTS.get(post_type, _GENERATE_PROMPTS["weekly_opportunities"])

    # Find matching metadata
    meta = next((p for p in _LAUNCH_POSTS if p["type"] == post_type), _LAUNCH_POSTS[0])

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        # Fallback: create a placeholder post
        content = f"<p>This article will be auto-generated once OPENAI_API_KEY is set in Railway environment. Type: {post_type}</p>"
        title = meta["title"]
    else:
        try:
            client = AsyncOpenAI(api_key=api_key)
            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are an expert art market analyst."},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=1200,
                temperature=0.7,
            )
            content = response.choices[0].message.content or ""
            title = meta["title"]
        except Exception as e:
            content = f"<p>Auto-generation failed: {str(e)[:100]}. Please edit this post manually.</p>"
            title = meta["title"]

    # Check if post with this slug already exists
    slug = meta["slug"]
    existing = (await db.execute(select(BlogPost).where(BlogPost.slug == slug))).scalar_one_or_none()
    if existing:
        # Update content
        existing.content = content
        existing.updated_at = datetime.utcnow()
        await db.commit()
        return _serialize(existing)

    post = BlogPost(
        slug=slug,
        title=title,
        excerpt=title + " — Art market intelligence by Nautilus.",
        content=content,
        author="Nautilus Editorial",
        tags=meta.get("tags", []),
        read_time_minutes=meta.get("read_time_minutes", 5),
        is_published=True,
        published_at=datetime.utcnow(),
    )
    db.add(post)
    await db.commit()
    await db.refresh(post)
    return _serialize(post)


@router.post("/seed", status_code=201)
async def seed_launch_posts(
    db: AsyncSession = Depends(get_db),
    _:  bool         = Depends(verify_admin),
):
    """Seed all 4 launch blog posts if they don't exist. Uses GPT or fallback text."""
    results = []
    for meta in _LAUNCH_POSTS:
        # Skip if already exists
        existing = (await db.execute(select(BlogPost).where(BlogPost.slug == meta["slug"]))).scalar_one_or_none()
        if existing:
            results.append({"slug": meta["slug"], "status": "already_exists"})
            continue

        # Call generate for each type
        try:
            result = await generate_blog_post({"type": meta["type"]}, db, True)
            results.append({"slug": meta["slug"], "status": "created", "id": result.get("id")})
        except Exception as e:
            results.append({"slug": meta["slug"], "status": "error", "error": str(e)})

    return {"seeded": results}
