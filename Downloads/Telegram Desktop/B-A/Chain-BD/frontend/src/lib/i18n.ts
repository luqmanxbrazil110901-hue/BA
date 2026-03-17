export type Locale = "en" | "zh" | "vi"

export const LOCALES: { value: Locale; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "zh", label: "ZH" },
  { value: "vi", label: "VN" },
]

export const translations = {
  en: {
    // Header
    appTitle:       "ETH User Analysis",
    langLabel:      "English",
    lightMode:      "Light",
    darkMode:       "Dark",
    adminLabel:     "admin (Admin)",

    // Toolbar
    dataList:       "Data List",
    totalEntries:   "Total {total} entries, current {start}–{end}",
    searchPlaceholder: "Search address/ID",
    advancedFilter: "Advanced Filter",
    downloadPage:   "Download Page",
    refresh:        "Refresh",

    // Sidebar
    filterTitle:    "Filter",
    filterHint:     "Click dimension value to filter, click again to clear",
    clearFilters:   "Clear",

    // Filter groups
    dataSource:     "Data Source",
    clientType:     "Client Type",
    clientTier:     "Client Tier",
    review:         "Review",
    freqCycle:      "Freq. Cycle",
    freqTier:       "Freq. Tier",
    addressPurity:  "Address Purity",
    hasTc:          "Has TC",

    // Table headers
    colAddress:     "Address",
    colClientId:    "Client ID",
    colDataSource:  "Data Source",
    colClientType:  "Client Type",
    colClientTier:  "Client Tier",
    colHasTc:       "Has TC",
    colReview:      "Review",
    colFreqCycle:   "Freq. Cycle",
    colFreqTier:    "Freq. Tier",
    colPurity:      "Address Purity",
    colBalance:     "Balance USD",
    colTxPeriod:    "Tx in Period",
    colCollection:  "Collection Date",
    colUpdate:      "Update Time",
    colReviewer:    "Reviewer",

    // Pagination
    first: "First", prev: "Prev", next: "Next", last: "Last",
    perPage: "Per page",

    noData: "No data found",
  },

  zh: {
    appTitle:       "ETH 用户分析",
    langLabel:      "中文",
    lightMode:      "浅色",
    darkMode:       "深色",
    adminLabel:     "管理员 (Admin)",

    dataList:       "数据列表",
    totalEntries:   "共 {total} 条，当前 {start}–{end}",
    searchPlaceholder: "搜索地址/ID",
    advancedFilter: "高级筛选",
    downloadPage:   "下载本页",
    refresh:        "刷新",

    filterTitle:    "筛选",
    filterHint:     "点击维度值筛选，再次点击取消",
    clearFilters:   "清除",

    dataSource:     "数据来源",
    clientType:     "客户类型",
    clientTier:     "客户层级",
    review:         "审核状态",
    freqCycle:      "频率周期",
    freqTier:       "频率层级",
    addressPurity:  "地址纯度",
    hasTc:          "有TC",

    colAddress:     "地址",
    colClientId:    "客户ID",
    colDataSource:  "数据来源",
    colClientType:  "客户类型",
    colClientTier:  "客户层级",
    colHasTc:       "有TC",
    colReview:      "审核",
    colFreqCycle:   "频率周期",
    colFreqTier:    "频率层级",
    colPurity:      "地址纯度",
    colBalance:     "余额 (USD)",
    colTxPeriod:    "期间交易数",
    colCollection:  "采集日期",
    colUpdate:      "更新时间",
    colReviewer:    "审核员",

    first: "首页", prev: "上一页", next: "下一页", last: "末页",
    perPage: "每页",

    noData: "暂无数据",
  },

  vi: {
    appTitle:       "Phân Tích Người Dùng ETH",
    langLabel:      "Tiếng Việt",
    lightMode:      "Sáng",
    darkMode:       "Tối",
    adminLabel:     "quản trị (Admin)",

    dataList:       "Danh Sách Dữ Liệu",
    totalEntries:   "Tổng {total} mục, hiện {start}–{end}",
    searchPlaceholder: "Tìm địa chỉ/ID",
    advancedFilter: "Bộ Lọc Nâng Cao",
    downloadPage:   "Tải Trang",
    refresh:        "Làm Mới",

    filterTitle:    "Bộ Lọc",
    filterHint:     "Nhấn giá trị để lọc, nhấn lại để bỏ",
    clearFilters:   "Xóa",

    dataSource:     "Nguồn Dữ Liệu",
    clientType:     "Loại Khách Hàng",
    clientTier:     "Hạng Khách Hàng",
    review:         "Trạng Thái",
    freqCycle:      "Chu Kỳ",
    freqTier:       "Tần Suất",
    addressPurity:  "Độ Sạch Địa Chỉ",
    hasTc:          "Có TC",

    colAddress:     "Địa Chỉ",
    colClientId:    "ID Khách Hàng",
    colDataSource:  "Nguồn",
    colClientType:  "Loại",
    colClientTier:  "Hạng",
    colHasTc:       "Có TC",
    colReview:      "Xét Duyệt",
    colFreqCycle:   "Chu Kỳ",
    colFreqTier:    "Tần Suất",
    colPurity:      "Độ Sạch",
    colBalance:     "Số Dư (USD)",
    colTxPeriod:    "Giao Dịch",
    colCollection:  "Ngày Thu Thập",
    colUpdate:      "Cập Nhật",
    colReviewer:    "Người Duyệt",

    first: "Đầu", prev: "Trước", next: "Tiếp", last: "Cuối",
    perPage: "Mỗi trang",

    noData: "Không có dữ liệu",
  },
} satisfies Record<Locale, Record<string, string>>

export type TranslationKey = keyof typeof translations.en

export function t(
  locale: Locale,
  key: TranslationKey,
  vars?: Record<string, string | number>
): string {
  let str = translations[locale][key] ?? translations.en[key] ?? key
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(`{${k}}`, String(v))
    }
  }
  return str
}
