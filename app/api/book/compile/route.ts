import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { validateAuthOrReject, isAuthError } from "@/lib/auth";

// ============================================================================
// Book Compilation API
// ============================================================================
// Compiles selected stories into a book, uploads metadata to IPFS,
// and returns the IPFS hash for NFT minting.
//
// Authors can compile ANY of their stories - canonical status is optional.
// ============================================================================

interface BookMetadata {
  name: string;
  description: string;
  external_url: string;
  image?: string;
  attributes: Array<{
    trait_type: string;
    value: string | number;
  }>;
  stories: Array<{
    id: string;
    title: string;
    content: string;
    created_at: string;
    mood?: string;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const authResult = await validateAuthOrReject(request);
    if (isAuthError(authResult)) return authResult;
    const authenticatedUserId = authResult;

    const body = await request.json();
    const { title, entryIds, description, coverStyle, authorId, authorWallet } = body;

    // Validate input
    if (!entryIds || !Array.isArray(entryIds) || entryIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one entry is required to compile a book' },
        { status: 400 }
      );
    }

    if (!authorId) {
      return NextResponse.json(
        { error: 'Author ID is required' },
        { status: 400 }
      );
    }

    // Verify authorId matches authenticated user
    if (authenticatedUserId !== authorId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // 1. Verify all stories belong to the author
    const { data: stories, error: storiesError } = await supabase
      .from('stories')
      .select('id, title, content, created_at, mood, author_id')
      .in('id', entryIds);

    if (storiesError) {
      console.error('Error fetching stories:', storiesError);
      return NextResponse.json(
        { error: 'Failed to fetch stories' },
        { status: 500 }
      );
    }

    if (!stories || stories.length === 0) {
      return NextResponse.json(
        { error: 'No valid stories found with the provided IDs' },
        { status: 404 }
      );
    }

    // Verify ownership - all stories must belong to the author
    const unauthorizedStories = stories.filter(story => story.author_id !== authorId);
    if (unauthorizedStories.length > 0) {
      return NextResponse.json(
        { error: 'You can only compile your own stories' },
        { status: 403 }
      );
    }

    // 2. Create book metadata for IPFS
    const bookMetadata: BookMetadata = {
      name: title || `My Story Collection ${new Date().getFullYear()}`,
      description: description || 'A collection of personal stories and reflections',
      external_url: process.env.NEXT_PUBLIC_APP_URL || 'https://estories.app',
      attributes: [
        { trait_type: 'Story Count', value: stories.length },
        { trait_type: 'Cover Style', value: coverStyle || 'minimalist' },
        { trait_type: 'Compiled Date', value: new Date().toISOString().split('T')[0] },
        { trait_type: 'Author', value: authorWallet || 'Unknown' },
      ],
      stories: stories.map(story => ({
        id: story.id,
        title: story.title || 'Untitled',
        content: story.content,
        created_at: story.created_at,
        mood: story.mood,
      })),
    };

    // 3. Upload to IPFS via Pinata
    const pinataJWT = process.env.PINATA_JWT;
    if (!pinataJWT) {
      return NextResponse.json(
        { error: 'Server configuration error: IPFS upload not configured' },
        { status: 500 }
      );
    }

    const pinataFormData = new FormData();
    const metadataBlob = new Blob([JSON.stringify(bookMetadata)], { type: 'application/json' });
    pinataFormData.append('file', metadataBlob, 'book-metadata.json');

    // Pinata metadata
    const pinataMetadata = JSON.stringify({
      name: `book-${title?.replace(/\s+/g, '-').toLowerCase() || Date.now()}.json`,
    });
    pinataFormData.append('pinataMetadata', pinataMetadata);

    // Pinata options
    const pinataOptions = JSON.stringify({
      cidVersion: 1,
    });
    pinataFormData.append('pinataOptions', pinataOptions);

    const pinataRes = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${pinataJWT}`,
      },
      body: pinataFormData,
    });

    if (!pinataRes.ok) {
      const errorText = await pinataRes.text();
      console.error('Pinata upload failed:', errorText);
      return NextResponse.json(
        { error: 'Failed to upload book to IPFS' },
        { status: 500 }
      );
    }

    const pinataJson = await pinataRes.json();
    const ipfsHash = pinataJson.IpfsHash;
    const ipfsGateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/';

    // 4. Return success response
    const compiledBook = {
      title: bookMetadata.name,
      description: bookMetadata.description,
      entryIds,
      entryCount: stories.length,
      ipfsHash,
      ipfsUrl: `${ipfsGateway}${ipfsHash}`,
      author: authorWallet,
      coverStyle: coverStyle || 'minimalist',
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: compiledBook,
      message: 'Book compiled and uploaded to IPFS successfully!'
    });

  } catch (error) {
    console.error('Error compiling book:', error);
    return NextResponse.json(
      { error: 'Failed to compile book' },
      { status: 500 }
    );
  }
}
