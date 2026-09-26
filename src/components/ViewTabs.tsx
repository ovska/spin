import { ALL_VIEWS, currentTab, VIEW_LABELS } from '../state/ui';

export function ViewTabs() {
  return (
    <div class="tabs-row" role="tablist">
      {ALL_VIEWS.map((view) => (
        <button
          key={view}
          type="button"
          role="tab"
          aria-selected={currentTab.value === view}
          class={`tab${currentTab.value === view ? ' tab--active' : ''}`}
          onClick={() => {
            currentTab.value = view;
          }}
        >
          {VIEW_LABELS[view]}
        </button>
      ))}
    </div>
  );
}
