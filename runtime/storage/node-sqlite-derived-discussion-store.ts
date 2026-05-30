/**
 * File: node-sqlite-derived-discussion-store.ts
 * Description: SQLite adapter for discussion-derived projection tables owned outside canonical packet mutation services.
 */

import { DatabaseSync } from 'node:sqlite';

import type { DiscussionPostIndexRecord } from '@runtime/storage/sqlite-records';

export class NodeSQLiteDerivedDiscussionStore {
  private readonly databasePath: string;

  constructor(input: { databasePath: string }) {
    this.databasePath = input.databasePath;
  }

  replaceDiscussionProjection(input: {
    discussionIndexRows: DiscussionPostIndexRecord[];
  }): void {
    const database = new DatabaseSync(this.databasePath);

    try {
      database.exec('BEGIN IMMEDIATE');
      database.exec('DELETE FROM discussion_post_index');
      database.exec('DELETE FROM discussion_actor_ledger');
      const insertDiscussionIndexStatement = database.prepare(`
        INSERT INTO discussion_post_index (
          post_packet_id,
          thread_packet_id,
          root_post_packet_id,
          reply_to_packet_id,
          depth,
          author_key,
          created_at,
          last_activity_at,
          direct_reply_count,
          descendant_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const row of input.discussionIndexRows) {
        insertDiscussionIndexStatement.run(
          row.post_packet_id,
          row.thread_packet_id,
          row.root_post_packet_id,
          row.reply_to_packet_id,
          row.depth,
          row.author_key,
          row.created_at,
          row.last_activity_at,
          row.direct_reply_count,
          row.descendant_count
        );
      }

      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    } finally {
      database.close();
    }
  }
}
