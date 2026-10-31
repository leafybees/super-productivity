import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { ProjectService } from '../features/project/project.service';
import { TagService } from '../features/tag/tag.service';
import { WorkContextService } from '../features/work-context/work-context.service';
import { T } from '../t.const';
import { PluginWorkContextService } from './plugin-work-context.service';

describe('PluginWorkContextService.openWorkContext', () => {
  let service: PluginWorkContextService;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    router = jasmine.createSpyObj('Router', ['navigate']);
    router.navigate.and.resolveTo(true);

    TestBed.configureTestingModule({
      providers: [
        PluginWorkContextService,
        { provide: Router, useValue: router },
        { provide: WorkContextService, useValue: { activeWorkContext$: of(null) } },
        {
          provide: ProjectService,
          useValue: { list$: of([{ id: 'project-1' }, { id: 'archived-1' }]) },
        },
        { provide: TagService, useValue: { tags$: of([{ id: 'tag-1' }]) } },
        {
          provide: TranslateService,
          useValue: {
            instant: (key: string, params?: { contextId: string }) =>
              `${key}:${params?.contextId}`,
          },
        },
      ],
    });
    service = TestBed.inject(PluginWorkContextService);
  });

  it('navigates to a project task list', async () => {
    await service.openWorkContext('project-1', 'PROJECT');

    expect(router.navigate).toHaveBeenCalledWith(['/project', 'project-1', 'tasks']);
  });

  it('navigates to a tag task list', async () => {
    await service.openWorkContext('tag-1', 'TAG');

    expect(router.navigate).toHaveBeenCalledWith(['/tag', 'tag-1', 'tasks']);
  });

  it('navigates to Today', async () => {
    await service.openWorkContext('TODAY', 'TODAY');

    expect(router.navigate).toHaveBeenCalledWith(['/tag', 'TODAY', 'tasks']);
  });

  it('rejects an unknown project id without navigating', async () => {
    await expectAsync(
      service.openWorkContext('missing', 'PROJECT'),
    ).toBeRejectedWithError(`${T.PLUGINS.PROJECT_NOT_FOUND}:missing`);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('rejects an unknown tag id without navigating', async () => {
    await expectAsync(service.openWorkContext('missing', 'TAG')).toBeRejectedWithError(
      `${T.PLUGINS.TAG_NOT_FOUND}:missing`,
    );
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('rejects a project id passed as a tag', async () => {
    await expectAsync(service.openWorkContext('project-1', 'TAG')).toBeRejected();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it("rejects type 'TODAY' with another id", async () => {
    await expectAsync(service.openWorkContext('tag-1', 'TODAY')).toBeRejected();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('rejects an empty id or unknown type from an untyped caller', async () => {
    await expectAsync(service.openWorkContext('', 'PROJECT')).toBeRejected();
    await expectAsync(
      service.openWorkContext('project-1', 'NOTE' as unknown as 'PROJECT'),
    ).toBeRejected();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
