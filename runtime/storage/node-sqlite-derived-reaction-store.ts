/**
 * File: node-sqlite-derived-reaction-store.ts
 * Description: SQLite adapter for reaction-derived projection tables owned outside canonical packet mutation services.
 */

import { DatabaseSync } from 'node:sqlite';

import type {
  ReactionIndexRecord,
  ReactionTallyIndexRecord,
} from '@runtime/storage/sqlite-records';

export class NodeSQLiteDerivedReactionStore {
  private readonly databasePath: string;

  constructor(input: { databasePath: string }) {
    this.databasePath = input.databasePath;
  }

  listReactionIndexRows(): ReactionIndexRecord[] {
    const database = new DatabaseSync(this.databasePath);

    try {
      return database
        .prepare(
          `
            SELECT
              reaction_packet_id,
              target_packet_id,
              actor_key,
              vote_value,
              attestation_value,
              emoji_keys_json,
              status,
              context_packet_id,
              note,
              created_at,
              updated_at
            FROM reaction_index
          `
        )
        .all() as unknown as ReactionIndexRecord[];
    } finally {
      database.close();
    }
  }

  listReactionTallyRows(): ReactionTallyIndexRecord[] {
    const database = new DatabaseSync(this.databasePath);

    try {
      return database
        .prepare(
          `
            SELECT
              target_packet_id,
              upvote_count,
              downvote_count,
              net_score,
              total_votes,
              negative_ratio,
              auto_hidden,
              deprioritized
            FROM reaction_tally_index
          `
        )
        .all() as unknown as ReactionTallyIndexRecord[];
    } finally {
      database.close();
    }
  }

  replaceReactionProjection(input: {
    indexRows: ReactionIndexRecord[];
    tallyRows: ReactionTallyIndexRecord[];
  }): void {
    const database = new DatabaseSync(this.databasePath);

    try {
      database.exec('BEGIN IMMEDIATE');
      database.exec('DELETE FROM reaction_index');
      database.exec('DELETE FROM reaction_tally_index');

      const insertIndexStatement = database.prepare(`
        INSERT INTO reaction_index (
          reaction_packet_id,
          target_packet_id,
          actor_key,
          vote_value,
          attestation_value,
          emoji_keys_json,
          status,
          context_packet_id,
          note,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertTallyStatement = database.prepare(`
        INSERT INTO reaction_tally_index (
          target_packet_id,
          upvote_count,
          downvote_count,
          net_score,
          total_votes,
          negative_ratio,
          auto_hidden,
          deprioritized
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const row of input.indexRows) {
        insertIndexStatement.run(
          row.reaction_packet_id,
          row.target_packet_id,
          row.actor_key,
          row.vote_value,
          row.attestation_value,
          row.emoji_keys_json,
          row.status,
          row.context_packet_id,
          row.note,
          row.created_at,
          row.updated_at
        );
      }

      for (const row of input.tallyRows) {
        insertTallyStatement.run(
          row.target_packet_id,
          row.upvote_count,
          row.downvote_count,
          row.net_score,
          row.total_votes,
          row.negative_ratio,
          row.auto_hidden,
          row.deprioritized
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
