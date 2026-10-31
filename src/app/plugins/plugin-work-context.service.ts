import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { ProjectService } from '../features/project/project.service';
import { TODAY_TAG } from '../features/tag/tag.const';
import { TagService } from '../features/tag/tag.service';
import { WorkContextService } from '../features/work-context/work-context.service';
import { T } from '../t.const';
import { PluginLog } from '../core/log';
import { ActiveWorkContext } from './plugin-api.model';
import { toActiveWorkContext } from './util/active-work-context.util';

const WORK_CONTEXT_TYPES: ReadonlyArray<ActiveWorkContext['type']> = [
  'PROJECT',
  'TAG',
  'TODAY',
];

/**
 * Plugin-facing reads and navigation for work contexts (projects and tags).
 * Kept out of PluginBridgeService so that grandfathered file does not grow.
 */
@Injectable({ providedIn: 'root' })
export class PluginWorkContextService {
  private _workContextService = inject(WorkContextService);
  private _projectService = inject(ProjectService);
  private _tagService = inject(TagService);
  private _router = inject(Router);
  private _translateService = inject(TranslateService);

  /**
   * Snapshot of the active work context for plugins. A context is always
   * active once the app has loaded — it stays set even on non-work-view
   * routes — so this normally resolves to that context. It resolves to
   * null only if the initial data load has not completed within the
   * timeout (e.g. a plugin calling this very early from its init hook),
   * which is preferable to a Promise that never resolves.
   */
  async getActiveWorkContext(): Promise<ActiveWorkContext | null> {
    try {
      const ctx = await firstValueFrom(
        this._workContextService.activeWorkContext$.pipe(
          // 10s is well past normal data-load time but still bounded so
          // a plugin can fall back to other behaviour instead of hanging.
          timeout({ first: 10_000 }),
        ),
      );
      return toActiveWorkContext(ctx);
    } catch {
      return null;
    }
  }

  /**
   * Navigate to a project's or tag's task list, the same route the side nav
   * uses. Uses the `ActiveWorkContext` type vocabulary, so a plugin can pass
   * back what `getActiveWorkContext()` returned. Archived and hidden projects
   * are allowed — the UI can open them too. Rejects for an unknown id.
   */
  async openWorkContext(id: string, type: ActiveWorkContext['type']): Promise<void> {
    if (typeof id !== 'string' || !id) {
      throw new Error('openWorkContext requires an id');
    }
    if (!WORK_CONTEXT_TYPES.includes(type)) {
      throw new Error(`openWorkContext: unknown type "${String(type)}"`);
    }

    if (type === 'PROJECT') {
      const projects = await firstValueFrom(this._projectService.list$);
      if (!projects.some((project) => project.id === id)) {
        throw new Error(
          this._translateService.instant(T.PLUGINS.PROJECT_NOT_FOUND, { contextId: id }),
        );
      }
      await this._router.navigate(['/project', id, 'tasks']);
    } else {
      if (type === 'TODAY' && id !== TODAY_TAG.id) {
        throw new Error(`openWorkContext: type "TODAY" requires id "${TODAY_TAG.id}"`);
      }
      // TODAY is virtual and always routable, so it needs no lookup.
      if (id !== TODAY_TAG.id) {
        const tags = await firstValueFrom(this._tagService.tags$);
        if (!tags.some((tag) => tag.id === id)) {
          throw new Error(
            this._translateService.instant(T.PLUGINS.TAG_NOT_FOUND, { contextId: id }),
          );
        }
      }
      await this._router.navigate(['/tag', id, 'tasks']);
    }

    PluginLog.log('PluginWorkContext: Opened work context', { id, type });
  }
}
