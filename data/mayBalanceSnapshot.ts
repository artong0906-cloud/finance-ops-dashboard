import type { BalanceMovement } from "@/types/finance";

const month = "2026-05";

function asset(
  id: string,
  category: string,
  amount: number,
  memo = "",
  openingAmount = amount,
  decreaseAmount = openingAmount - amount
): BalanceMovement {
  return {
    id: `may-asset-${id}`,
    month,
    statementType: "자산",
    category,
    openingAmount,
    increaseAmount: 0,
    decreaseAmount,
    memo
  };
}

function liability(id: string, category: string, amount: number, memo = ""): BalanceMovement {
  return {
    id: `may-liability-${id}`,
    month,
    statementType: "부채",
    category,
    openingAmount: amount,
    increaseAmount: 0,
    decreaseAmount: 0,
    memo
  };
}

function vehicle(
  id: string,
  name: string,
  acquiredAt: string,
  acquisitionCost: number,
  currentValue: number,
  monthlyDepreciation: number
) {
  return {
    ...asset(
      `vehicle-${id}`,
      name,
      currentValue,
      "법인차량",
      acquisitionCost
    ),
    acquiredAt,
    monthlyDepreciation
  };
}

function deposit(id: string, name: string, amount: number) {
  return asset(`deposit-${id}`, name, amount, "보증금");
}

function simpleAsset(id: string, groupMemo: string, name: string, amount: number) {
  return asset(`${groupMemo}-${id}`, name, amount, groupMemo);
}

export const mayBalanceMovements: BalanceMovement[] = [
  vehicle("001", "마세라티 콰포", "23.05", 48_641_382, 27_473_107, 305_565),
  vehicle("002", "벤츠 GLE", "23.06", 70_894_160, 43_664_253, 485_649),
  vehicle("003", "벤츠 GLB", "23.08", 48_531_430, 31_409_322, 349_345),
  vehicle("004", "BMW 730D", "23.08", 74_000_000, 54_074_053, 601_430),
  vehicle("005", "벤츠 E200", "23.01", 28_397_240, 21_804_053, 242_512),
  vehicle("006", "BMW 520i 3918", "23.11", 28_595_700, 19_187_567, 213_411),
  vehicle("007", "아우디 Q3", "23.12", 11_000_000, 9_157_702, 101_855),
  vehicle("008", "BMW X1", "24.03", 48_000_000, 37_939_052, 421_971),
  vehicle("009", "BMW IX", "24.05", 77_700_000, 63_667_834, 708_136),
  vehicle("010", "BMW 523d", "24.06", 63_500_000, 49_277_161, 548_078),
  vehicle("011", "벤츠 E250", "24.06", 42_947_323, 34_886_486, 388_020),
  vehicle("012", "벤츠 CLS", "24.06", 53_572_998, 39_247_296, 436_522),
  vehicle("013", "스프린터", "24.10", 76_000_000, 54_946_213, 611_131),
  vehicle("014", "벤츠 GLA", "24.11", 49_000_000, 41_863_783, 465_623),
  vehicle("015", "제네시스 GV80", "25.11", 75_900_000, 71_026_355, 789_980),
  vehicle("016", "싼타페 7912", "26.01", 40_100_000, 38_364_500, 426_703),
  vehicle("017", "BMW5 7211", "26.02", 38_000_000, 36_759_743, 408_855),
  vehicle("018", "고승현 2791", "26.04", 2_800_000, 2_738_739, 30_461),
  vehicle("019", "포르쉐 마칸", "25.01", 87_000_000, 78_494_591, 873_044),
  vehicle("020", "제네시스 GV70", "25.02", 48_000_000, 37_502_971, 417_121),
  vehicle("021", "스타리아", "25.10", 40_990_000, 37_936_037, 421_938),
  vehicle("022", "포터 윙바디", "25.10", 26_300_000, 24_340_516, 270_724),
  vehicle("023", "BMW M235i", "25.10", 37_000_000, 34_243_313, 380_866),
  vehicle("024", "벤츠 CLA", "25.10", 46_000_000, 42_572_767, 473_509),
  vehicle("025", "벤츠 C200", "25.10", 23_800_000, 22_026_780, 244_989),
  vehicle("026", "G80", "25.10", 37_000_000, 34_243_313, 380_866),
  vehicle("027", "벤츠 GLB250", "25.10", 52_130_000, 48_246_051, 536_609),
  vehicle("028", "싼타페", "25.10", 34_900_000, 32_299_773, 359_249),
  vehicle("029", "BMW 520i 2277", "25.10", 31_000_000, 28_690_343, 319_104),
  vehicle("030", "벤츠 A220", "25.10", 28_500_000, 26_376_606, 293_370),
  vehicle("031", "벤츠 EQA250", "25.11", 48_000_000, 44_917_853, 499_592),
  vehicle("032", "KGM 액티언", "25.11", 27_000_000, 25_266_292, 281_020),
  vehicle("033", "BMW X1", "25.11", 18_900_000, 17_686_405, 196_714),
  vehicle("034", "제네시스 G90", "25.11", 49_500_000, 46_321_536, 515_204),
  vehicle("035", "카니발", "26.01", 43_500_000, 41_617_350, 462_883),

  deposit("001", "동강대 벙커 보증금", 50_000_000),
  deposit("002", "가상오피스보증금", 380_000),
  deposit("003", "동강빌딩 보증금", 8_000_000),
  deposit("004", "포스코 사택 보증금", 40_000_000),
  deposit("005", "무등산자이 사택 보증금", 70_000_000),
  deposit("006", "혜은 SK뷰 사택 보증금", 70_000_000),
  deposit("007", "봉선 사택 보증금", 50_000_000),
  deposit("008", "상상플랫폼 보증금", 20_000_000),
  deposit("009", "창완 SK뷰 사택 보증금", 50_000_000),
  deposit("010", "두암동889-15(카페츄)", 10_000_000),
  deposit("011", "모아엘가 사택 보증금", 100_000_000),
  deposit("012", "서방로135-2(편의점)", 10_000_000),
  deposit("013", "서방로138(미용실)", 15_000_000),
  deposit("014", "서방로134-1(안경점)", 10_000_000),
  deposit("015", "협력하우스", 2_000_000),
  deposit("016", "동강빌딩 도시가스", 300_000),
  deposit("017", "무등산자이2 사택보증금", 50_000_000),
  deposit("018", "제일풍경채 사택보증금", 30_000_000),
  deposit("019", "좋은하루 사택보증금", 4_000_000),
  deposit("020", "좋아하며 사택보증금", 2_000_000),

  simpleAsset("001", "무형자산", "앱/웹 개발 지출", 189_057_883),
  simpleAsset("002", "유형자산", "두암동 올라타움", 130_000_000),
  simpleAsset("003", "유형자산", "병커 인테리어/비품", 80_000_000),
  simpleAsset("004", "유형자산", "광고인거리 인테리어", 74_642_633),
  simpleAsset("005", "유형자산", "사무실 비품 (2025년)", 102_705_732),
  simpleAsset("006", "유형자산", "사무실 비품 (2026년)", 44_296_860),
  simpleAsset("007", "유형자산", "산수동 사옥 필지", 2_119_361_966),
  simpleAsset("008", "유형자산", "산수동 사옥 건축설계", 42_840_000),
  simpleAsset("009", "유형자산", "동명동156 토지", 865_031_436),

  simpleAsset("001", "대여금", "대여금(문시욱)", 101_320_000),
  simpleAsset("002", "대여금", "대여금(김희수)", 30_020_000),
  simpleAsset("003", "대여금", "대여금(박승훈)", 70_000_000),
  simpleAsset("004", "대여금", "대여금(유용현)", 60_000_000),
  simpleAsset("005", "대여금", "대여금(김세훈)", 47_000_000),
  simpleAsset("006", "대여금", "대여금(정효중)", 24_000_000),
  simpleAsset("007", "대여금", "대여금(김유원)", 104_800_000),
  simpleAsset("008", "대여금", "대여금(노우리)", 19_800_000),
  simpleAsset("009", "대여금", "대여금(선혜원)", 24_080_000),
  simpleAsset("010", "대여금", "대여금(고승현)", 21_480_000),
  simpleAsset("011", "대여금", "대여금(현혜정)", 30_000_000),
  simpleAsset("012", "대여금", "대여금(김호빈)", 30_000_000),
  simpleAsset("013", "대여금", "대여금(김수인)", 10_000_000),
  simpleAsset("014", "대여금", "투자금(커피스미스)", 110_000_000),
  simpleAsset("015", "대여금", "투자금(노브랜드)", 309_850_000),

  simpleAsset("001", "광고비", "광고비 잔액", 177_928_931),
  simpleAsset("002", "광고비", "메조미디어 25년 역량지급", 150_309_713),
  simpleAsset("003", "광고비", "메조미디어 26년 역량지급", 52_559_794),

  simpleAsset("001", "현금성자산", "기업은행 현금", 200_939_666),
  simpleAsset("002", "현금성자산", "신한은행 현금", 77_320_971),
  simpleAsset("003", "현금성자산", "하나은행 현금", 8_066_133),
  simpleAsset("004", "현금성자산", "한국투자증권", 151_990_931),
  simpleAsset("005", "현금성자산", "선급금(FMK)", 40_000_000),
  simpleAsset("006", "현금성자산", "지식재산 공제부금", 2_100_000),

  liability("vehicle-001", "벤츠 GLB", 7_380_371, "차량 부채"),
  liability("vehicle-002", "BMW 730D", 3_559_650, "차량 부채"),
  liability("vehicle-003", "BMW X1", 5_014_115, "차량 부채"),
  liability("vehicle-004", "BMW IX", 18_206_671, "차량 부채"),
  liability("vehicle-005", "BMW 523D", 5_738_417, "차량 부채"),
  liability("vehicle-006", "벤츠 GLA", 6_776_642, "차량 부채"),
  liability("vehicle-007", "BMW M235i", 33_511_973, "차량 부채"),
  liability("vehicle-008", "벤츠 CLA", 14_571_489, "차량 부채"),
  liability("vehicle-009", "벤츠 C200", 10_796_455, "차량 부채"),
  liability("vehicle-010", "BMW 520i 2277", 13_508_531, "차량 부채"),
  liability("vehicle-011", "벤츠 A220", 12_608_238, "차량 부채"),
  liability("vehicle-012", "벤츠 GLB250", 22_873_535, "차량 부채"),
  liability("vehicle-013", "벤츠 EQA250", 21_958_812, "차량 부채"),
  liability("vehicle-014", "제네시스 GV80", 34_673_964, "차량 부채"),
  liability("vehicle-015", "BMW5 7211", 25_555_278, "차량 부채"),

  liability("bank-001", "신한은행(증신공)", 940_000_000, "은행대출 부채"),
  liability("bank-002", "하나은행(기.보)", 500_000_000, "은행대출 부채"),
  liability("bank-003", "중진공(링크업)", 450_000_000, "은행대출 부채"),
  liability("bank-004", "기.보(클린보증)", 618_636_120, "은행대출 부채"),
  liability("bank-005", "기업은행(동명동)", 730_000_000, "은행대출 부채"),
  liability("bank-006", "신한은행(산수동)", 400_000_000, "은행대출 부채"),

  liability("other-001", "5월 법인카드대금", 66_300_000, "기타 부채"),
  liability("other-002", "5월 예정 급여", 300_000_000, "기타 부채"),
  liability("other-003", "충전 예정 광고비", 105_812_595, "기타 부채")
];
