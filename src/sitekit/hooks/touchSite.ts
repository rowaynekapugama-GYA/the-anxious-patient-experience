import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, GlobalAfterChangeHook } from 'payload'

/**
 * Records that something changed, so the Dashboard can show the
 * "changes waiting to publish" notice.
 */
async function touch(req: { payload: { updateGlobal: Function } }) {
  try {
    await req.payload.updateGlobal({
      slug: 'site-status',
      data: { lastChangedAt: new Date().toISOString() },
      depth: 0,
    })
  } catch {
    // never let bookkeeping stop a save
  }
}

export const touchSite: CollectionAfterChangeHook & CollectionAfterDeleteHook = async ({ req }) => {
  await touch(req as never)
}

export const touchSiteGlobal: GlobalAfterChangeHook = async ({ req, doc }) => {
  await touch(req as never)
  return doc
}
