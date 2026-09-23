import { describe, expect, it } from "vitest";
import { getResourceSnapshot, retainResourceDataOnFailure } from "./use-resource";

const firstData = { id: "first-task", title: "Сохранённая задача" };
const loadFirst = async () => firstData;
const loadSecond = async () => ({ id: "second-task", title: "Другая задача" });
const saved = { load: loadFirst, revision: 0, data: firstData, error: "" };

describe("resource refresh state", () => {
  it("keeps the first load error blocking and retries in the loading state", () => {
    const failed = retainResourceDataOnFailure(null, loadFirst, 0, "Нет соединения");
    expect(getResourceSnapshot(failed, loadFirst, 0)).toEqual({
      data: null, loading: false, refreshing: false, error: "Нет соединения", refreshError: "",
    });
    expect(getResourceSnapshot(failed, loadFirst, 1)).toEqual({
      data: null, loading: true, refreshing: false, error: "", refreshError: "",
    });
  });

  it("keeps loaded data visible while a refresh is pending", () => {
    expect(getResourceSnapshot(saved, loadFirst, 1)).toEqual({
      data: firstData, loading: false, refreshing: true, error: "", refreshError: "",
    });
  });

  it("reports a failed refresh separately without discarding previous data", () => {
    const failed = retainResourceDataOnFailure(saved, loadFirst, 1, "Нет соединения");
    expect(getResourceSnapshot(failed, loadFirst, 1)).toEqual({
      data: firstData, loading: false, refreshing: false, error: "", refreshError: "Нет соединения",
    });
    expect(getResourceSnapshot(failed, loadFirst, 2)).toEqual({
      data: firstData, loading: false, refreshing: true, error: "", refreshError: "Нет соединения",
    });
  });

  it("never exposes the old task while another id is loading or has failed", () => {
    expect(getResourceSnapshot(saved, loadSecond, 0)).toEqual({
      data: null, loading: true, refreshing: false, error: "", refreshError: "",
    });
    const failed = retainResourceDataOnFailure(saved, loadSecond, 0, "Задача не найдена");
    expect(getResourceSnapshot(failed, loadSecond, 0)).toEqual({
      data: null, loading: false, refreshing: false, error: "Задача не найдена", refreshError: "",
    });
  });

  it("clears the refresh failure once fresh data arrives", () => {
    const updated = { ...firstData, title: "Обновлённая задача" };
    expect(getResourceSnapshot({ load: loadFirst, revision: 2, data: updated, error: "" }, loadFirst, 2)).toEqual({
      data: updated, loading: false, refreshing: false, error: "", refreshError: "",
    });
  });

  it("treats a loaded empty list as data that can be kept during refresh", () => {
    const loadEmpty = async () => [] as string[];
    const failed = retainResourceDataOnFailure({ load: loadEmpty, revision: 0, data: [], error: "" }, loadEmpty, 1, "Нет соединения");
    expect(getResourceSnapshot(failed, loadEmpty, 1)).toEqual({
      data: [], loading: false, refreshing: false, error: "", refreshError: "Нет соединения",
    });
  });
});
