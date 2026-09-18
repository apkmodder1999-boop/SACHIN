// ============================================================================
// CLOUDFLARE PAGES FUNCTION
// FILE: /functions/api/active.js
//
// ROUTE:
//   /api/active
//
// ADMIN ACCESS:
//   /api/active?key=shivuu
//   /api/active?key=adii
//
// PURPOSE:
//   1. Fetch /api/fetch_active?page=1
//   2. Follow all pagination pages
//   3. Merge all returned batches
//   4. Remove duplicate batch IDs
//   5. Return:
//        - userId
//        - token
//        - batchId
//        - batchName
//        - batchImage
//
// UNAUTHORIZED:
//   Requests without a valid admin key return:
//   Unauthorized Access
// ============================================================================


// ============================================================================
// SETTINGS
// ============================================================================

const MAX_PAGES = 20;
const PAGE_TIMEOUT = 15000;


// ============================================================================
// HARD-CODED ADMIN KEYS
// ============================================================================

const ADMIN_KEYS = new Set([
    "shivuu",
    "adii"
]);


// ============================================================================
// RESPONSE HEADERS
// ============================================================================

const HEADERS = {

    "Access-Control-Allow-Origin": "*",

    "Access-Control-Allow-Methods":
        "GET, OPTIONS",

    "Access-Control-Allow-Headers":
        "*",

    "Content-Type":
        "application/json; charset=UTF-8",

    "Cache-Control":
        "no-store, no-cache, must-revalidate, max-age=0",

    "Pragma":
        "no-cache"

};


// ============================================================================
// ADMIN AUTHORIZATION
// ============================================================================

function isAuthorized(request) {

    const url =
        new URL(request.url);

    const suppliedKey =
        url.searchParams.get("key");

    if (!suppliedKey) {

        return false;

    }

    return ADMIN_KEYS.has(
        suppliedKey
    );

}


// ============================================================================
// UNAUTHORIZED RESPONSE
// ============================================================================

function unauthorizedResponse() {

    return new Response(

        JSON.stringify(

            {
                status: 401,
                error: "Unauthorized Access"
            },

            null,
            4

        ),

        {
            status: 401,
            headers: HEADERS
        }

    );

}


// ============================================================================
// FETCH WITH TIMEOUT
// ============================================================================

async function fetchWithTimeout(
    url,
    options = {},
    timeout = PAGE_TIMEOUT
) {

    const controller =
        new AbortController();

    const timer =
        setTimeout(

            () =>
                controller.abort(),

            timeout

        );


    try {

        return await fetch(

            url,

            {
                ...options,

                signal:
                    controller.signal
            }

        );

    } finally {

        clearTimeout(
            timer
        );

    }

}


// ============================================================================
// FIRST PAGE URL
// ============================================================================

function getFirstPageUrl(request) {

    const incoming =
        new URL(
            request.url
        );


    const firstPage =
        new URL(
            "/api/fetch_active",
            incoming.origin
        );


    firstPage.searchParams.set(
        "page",
        "1"
    );


    return firstPage.toString();

}


// ============================================================================
// FETCH ONE PAGE
// ============================================================================

async function fetchPage(url) {

    const response =
        await fetchWithTimeout(

            url,

            {
                method: "GET",

                headers: {
                    "Accept":
                        "application/json"
                }
            }

        );


    if (!response.ok) {

        throw new Error(

            `fetch_active returned HTTP ${response.status}`

        );

    }


    let json;


    try {

        json =
            await response.json();

    } catch {

        throw new Error(
            "fetch_active returned invalid JSON."
        );

    }


    if (
        !json ||
        typeof json !== "object"
    ) {

        throw new Error(
            "Invalid fetch_active response."
        );

    }


    return json;

}


// ============================================================================
// EXTRACT BATCH
// ============================================================================

function extractBatch(course) {

    if (
        !course ||
        typeof course !== "object"
    ) {

        return null;

    }


    // ------------------------------------------------------------------------
    // BATCH ID
    // ------------------------------------------------------------------------

    if (
        course.id === undefined ||
        course.id === null
    ) {

        return null;

    }


    const id =
        String(
            course.id
        ).trim();


    if (!id) {

        return null;

    }


    // ------------------------------------------------------------------------
    // BATCH NAME
    // ------------------------------------------------------------------------

    const batchName =

        course.batch_name ??
        course.course_name ??
        course.title ??
        course.name ??
        course.batchName ??
        "Course Batch";


    // ------------------------------------------------------------------------
    // BATCH IMAGE
    // ------------------------------------------------------------------------

    const batchImage =

        course.batch_image ??
        course.course_thumbnail ??
        course.thumbnail ??
        course.cover ??
        course.image ??
        course.banner ??
        course.batch_thumbnail ??
        "";


    return {

        id,

        batch_name:
            String(
                batchName ||
                "Course Batch"
            ),

        batch_image:
            String(
                batchImage ||
                ""
            )

    };

}


// ============================================================================
// PROCESS ONE COURSE
// ============================================================================

function processCourse(
    batchMap,
    course
) {

    if (
        !course ||
        typeof course !== "object"
    ) {

        return false;

    }


    // ------------------------------------------------------------------------
    // ACCOUNT
    // ------------------------------------------------------------------------

    const account =
        course.account;


    if (
        !account ||
        typeof account !== "object"
    ) {

        return false;

    }


    // ------------------------------------------------------------------------
    // USER ID
    // ------------------------------------------------------------------------

    const rawUserId =

        account.userId ??
        account.user_id;


    if (
        rawUserId === undefined ||
        rawUserId === null
    ) {

        return false;

    }


    const userId =
        String(
            rawUserId
        ).trim();


    if (!userId) {

        return false;

    }


    // ------------------------------------------------------------------------
    // FULL TOKEN
    // ------------------------------------------------------------------------

    const token =

        account.token ??
        account.authorization ??
        "";


    // ------------------------------------------------------------------------
    // BATCH
    // ------------------------------------------------------------------------

    const batch =
        extractBatch(
            course
        );


    if (!batch) {

        return false;

    }


    // ========================================================================
    // UNIQUE BATCH RULE
    //
    // Same batch ID is returned only once.
    // First occurrence is retained.
    // ========================================================================

    if (
        batchMap.has(
            batch.id
        )
    ) {

        return false;

    }


    batchMap.set(

        batch.id,

        {

            userId,

            token,

            batch_id:
                batch.id,

            batch_name:
                batch.batch_name,

            batch_image:
                batch.batch_image

        }

    );


    return true;

}


// ============================================================================
// MAIN GET
// ============================================================================

export async function onRequestGet(
    context
) {

    const request =
        context.request;


    // ========================================================================
    // ADMIN CHECK
    // ========================================================================

    if (
        !isAuthorized(
            request
        )
    ) {

        return unauthorizedResponse();

    }


    // ========================================================================
    // MAIN PROCESSING
    // ========================================================================

    try {

        // =====================================================================
        // START FROM PAGE 1
        // =====================================================================

        let nextUrl =
            getFirstPageUrl(
                request
            );


        // =====================================================================
        // UNIQUE BATCH STORAGE
        // =====================================================================

        const batchMap =
            new Map();


        // =====================================================================
        // PAGINATION STATE
        // =====================================================================

        const visitedUrls =
            new Set();

        const pages =
            [];

        const errors =
            [];


        let totalPagesFetched =
            0;

        let totalBatchesReceived =
            0;

        let duplicateBatchesRemoved =
            0;


        // =====================================================================
        // FOLLOW ALL PAGES
        // =====================================================================

        while (

            nextUrl &&

            totalPagesFetched <
                MAX_PAGES

        ) {

            // -----------------------------------------------------------------
            // LOOP PROTECTION
            // -----------------------------------------------------------------

            if (
                visitedUrls.has(
                    nextUrl
                )
            ) {

                errors.push({

                    url:
                        nextUrl,

                    error:
                        "Pagination loop detected."

                });

                break;

            }


            visitedUrls.add(
                nextUrl
            );


            // -----------------------------------------------------------------
            // FETCH PAGE
            // -----------------------------------------------------------------

            let json;


            try {

                json =
                    await fetchPage(
                        nextUrl
                    );

            } catch (error) {

                errors.push({

                    url:
                        nextUrl,

                    error:
                        error?.message ||
                        "Failed to fetch page."

                });

                break;

            }


            totalPagesFetched++;


            // -----------------------------------------------------------------
            // PAGE DATA
            // -----------------------------------------------------------------

            const courses =

                Array.isArray(
                    json.data
                )

                    ? json.data

                    : [];


            totalBatchesReceived +=
                courses.length;


            // -----------------------------------------------------------------
            // PROCESS COURSES
            // -----------------------------------------------------------------

            let pageDuplicates =
                0;


            for (
                const course
                of courses
            ) {

                const added =
                    processCourse(
                        batchMap,
                        course
                    );


                if (!added) {

                    const batch =
                        extractBatch(
                            course
                        );


                    if (
                        batch &&
                        batchMap.has(
                            batch.id
                        )
                    ) {

                        pageDuplicates++;

                    }

                }

            }


            duplicateBatchesRemoved +=
                pageDuplicates;


            // -----------------------------------------------------------------
            // SAVE PAGE INFO
            // -----------------------------------------------------------------

            pages.push({

                page:
                    json.pagination?.page ??
                    totalPagesFetched,

                batchesReceived:
                    courses.length,

                uniqueBatchesAfterPage:
                    batchMap.size,

                duplicatesFound:
                    pageDuplicates

            });


            // -----------------------------------------------------------------
            // NEXT PAGE
            // -----------------------------------------------------------------

            const candidateNextUrl =

                json.pagination?.nextUrl ||
                json.nextUrl ||
                null;


            if (
                candidateNextUrl
            ) {

                try {

                    nextUrl =

                        new URL(

                            candidateNextUrl,

                            new URL(
                                request.url
                            ).origin

                        ).toString();

                } catch {

                    errors.push({

                        url:
                            candidateNextUrl,

                        error:
                            "Invalid nextUrl returned by fetch_active."

                    });

                    break;

                }

            } else {

                nextUrl =
                    null;

            }

        }


        // =====================================================================
        // MAX PAGE CHECK
        // =====================================================================

        const stoppedByMaxPages =

            Boolean(

                nextUrl &&

                totalPagesFetched >=
                    MAX_PAGES

            );


        // =====================================================================
        // FINAL UNIQUE DATA
        // =====================================================================

        const data =

            Array.from(
                batchMap.values()
            );


        // =====================================================================
        // FINAL RESPONSE
        // =====================================================================

        const response = {

            status:
                200,

            message:

                `Fetched ${data.length} unique batches ` +
                `from ${totalPagesFetched} pages.`,

            pagination: {

                pagesFetched:
                    totalPagesFetched,

                maxPages:
                    MAX_PAGES,

                complete:
                    !nextUrl,

                stoppedByMaxPages,

                remainingNextUrl:
                    nextUrl ||
                    null

            },

            stats: {

                batchesReceivedAcrossPages:
                    totalBatchesReceived,

                uniqueBatches:
                    data.length,

                duplicateBatchesRemoved

            },

            pages,

            errors,

            data

        };


        return new Response(

            JSON.stringify(
                response,
                null,
                4
            ),

            {
                status: 200,
                headers: HEADERS
            }

        );

    } catch (error) {

        return new Response(

            JSON.stringify(

                {
                    status:
                        500,

                    error:
                        error?.message ||
                        "Internal Server Error",

                    data:
                        []
                },

                null,
                4

            ),

            {
                status: 500,
                headers: HEADERS
            }

        );

    }

}


// ============================================================================
// OPTIONS
// ============================================================================

export async function onRequestOptions() {

    return new Response(

        null,

        {
            status:
                204,

            headers:
                HEADERS
        }

    );

}
