# tournaments/utils.py (или внизу views.py)

import math
from django.db import transaction
from datetime import timedelta
from django.utils import timezone
from .models import Match, Team, Tournament


def get_next_full_hour():
    """
    Возвращает текущий момент, округленный до ближайшего полного часа вперёд
    """
    now = timezone.now()
    rounded = now.replace(minute=0, second=0, microsecond=0)
    if now.minute != 0 or now.second != 0 or now.microsecond != 0:
        rounded += timedelta(hours=1)
    return rounded


def generate_single_bracket(tournament: Tournament, teams: list[Team]):
    """
    Single-elimination: строим «одно­круговую» выбывающую сетку.
    Если число команд не является степенью двойки, создаём «бай» (None).
    1) Рассчитываем ближайшую степень двойки.
    2) Добавляем бай-участников до полной степени двойки.
    3) Генерируем все матчи по раундам и связываем их через next_match_win.
    """
    # 1. Определяем N = ближайшая степень двойки ≥ len(teams)
    n = len(teams)
    power = 1
    while power < n:
        power <<= 1
    total_slots = power  # например, если 10 команд, power=16

    # 2. Формируем список участников длины total_slots, дополняя байами (None)
    bracket_list: list[Team | None] = teams.copy()
    # добавляем просто None, чтобы означать «бай»
    bracket_list.extend([None] * (total_slots - n))

    # 3. Количество раундов = log2(total_slots)
    rounds = int(math.log2(total_slots))

    # 4. Создаём пустые объекты Match для каждого раунда заранее,
    #    чтобы иметь куда подключать next_match_win.
    #    Структура: matches_by_round[r] = [список Match-объектов для раунда r]
    matches_by_round: dict[int, list[Match]] = {r: [] for r in range(1, rounds + 1)}

    # Вычисляем стартовый базовый час
    base_time = get_next_full_hour()

    # Используем transaction.atomic, чтобы на случай ошибки все записи откатились
    with transaction.atomic():
        # 4.1. Создадим все матчи для каждого раунда (без участников).
        for r in range(1, rounds + 1):
            matches_in_round = total_slots // (2**r)
            round_time = base_time + timedelta(hours=(r - 1))
            for i in range(matches_in_round):
                m = Match.objects.create(
                    tournament=tournament,
                    round_number=r,
                    bracket="WB",  # Winners Bracket
                    participant_a=None,
                    participant_b=None,
                    start_time=round_time,
                )
                matches_by_round[r].append(m)

        # 5. Теперь заполним участников первого раунда, а затем свяжем дальше по next_match_win.
        #    Первый раунд — r = 1, матч i получает:
        #       participant_a = bracket_list[2*i]
        #       participant_b = bracket_list[2*i + 1]
        for i, m in enumerate(matches_by_round[1]):
            m.participant_a = bracket_list[2 * i]
            m.participant_b = bracket_list[2 * i + 1]
            m.save(update_fields=["participant_a", "participant_b"])

        # 6. Связываем остальные раунды: победитель матча i раунда r идёт в participant_a матча i//2 раунда r+1
        for r in range(1, rounds):
            for idx, m in enumerate(matches_by_round[r]):
                # определяем, в какой «слот» следующего раунда попадёт победитель
                next_idx = idx // 2
                next_match = matches_by_round[r + 1][next_idx]
                # сохраняем связь только через победу (пока проигрыш никуда не идёт)
                m.next_match_win = next_match
                m.save(update_fields=["next_match_win"])

        # 7. Всё: сетка готова, статус турнира поменяется в вызывающем коде.


def generate_double_bracket(tournament: Tournament, teams: list[Team]):
    """
    Double-elimination: строим две сетки — Winners Bracket (WB) и Losers Bracket (LB).
    - Шаг 1: в WB как в single-elimination создаём сетку «power-of-two» участников (с бай-ячейками).
    - Шаг 2: проигравшие из раунда r WB переходят в LB на соответствующие позиции.
    - Шаг 3: строим LB, связав его матчи между собой и с WB.
    - Финал: объединяем последнего победителя LB и последнего победителя WB в final_match.
    """
    n = len(teams)
    power = 1
    while power < n:
        power <<= 1
    total_slots = power
    bracket_list = teams.copy()
    bracket_list.extend([None] * (power - n))
    rounds_wb = int(math.log2(power))

    # Храним матчи: {("WB", round_number): [...]} и {("LB", lb_round): [...]}
    matches_wb: dict[int, list[Match]] = {r: [] for r in range(1, rounds_wb + 1)}
    matches_lb: dict[int, list[Match]] = {}

    # Базовое время
    base_time = get_next_full_hour()

    with transaction.atomic():
        # 1) Создаём ВСЕ матчи WB без участников, аналогично single-elimination
        for r in range(1, rounds_wb + 1):
            count = total_slots // (2**r)
            round_time = base_time + timedelta(hours=(r - 1))
            for i in range(count):
                m = Match.objects.create(
                    tournament=tournament,
                    round_number=r,
                    bracket="WB",
                    participant_a=None,
                    participant_b=None,
                    start_time=round_time,
                )
                matches_wb[r].append(m)

        # 2) Заполняем участников первого раунда WB
        for i, m in enumerate(matches_wb[1]):
            m.participant_a = bracket_list[2 * i]
            m.participant_b = bracket_list[2 * i + 1]
            m.save(update_fields=["participant_a", "participant_b"])

        # 3) Связываем победителей WB «вперед» по WB
        for r in range(1, rounds_wb):
            for idx, m in enumerate(matches_wb[r]):
                winner_next = matches_wb[r + 1][idx // 2]
                m.next_match_win = winner_next
                m.save(update_fields=["next_match_win"])

        # 4) Формируем LB-круги. Всего в LB будет (rounds_wb - 1) + (rounds_wb) раундов:
        #    - Проигравшие из WB Round 1 идут в LB Round 1.
        #    - Победители LB Round 1 и проигравшие из WB Round 2 → LB Round 2, и т.д.
        total_lb_rounds = (rounds_wb - 1) + rounds_wb
        for r in range(1, total_lb_rounds + 1):
            matches_lb[r] = []

        # 5) Создаём ВСЕ матчи LB без участников. Количество матчей в LB раунде r
        #    можно вычислить, но для упрощения: на каждом этапе побеждает половина.
        #    Мы яснее свяжем проигравших из WB/победителей из LB ниже.
        for r in range(1, total_lb_rounds + 1):
            # В double-elimination количество матчей LB в раунде r:
            #   если r <= rounds_wb - 1: r * (power // (2 ** (r + 1)))
            #   если r > rounds_wb - 1: (rounds_wb - 1) * (power // (2 ** rounds_wb)) // (2 ** (r - rounds_wb))
            if r <= rounds_wb - 1:
                # первые (rounds_wb-1) раундов LB формируются проигравшими из WB
                match_count = 2 ** (r - 1)
            else:
                # оставшиеся раунды LB формируются между победителями LB
                match_count = 2 ** (total_lb_rounds - r)
                round_time = base_time + timedelta(hours=(r - 1))
            for i in range(match_count):
                m = Match.objects.create(
                    tournament=tournament,
                    round_number=r,
                    bracket="LB",
                    participant_a=None,
                    participant_b=None,
                    start_time=round_time,
                )
                matches_lb[r].append(m)

        # 6) Связывание проигравших из WB в LB:
        #    - Проигравшие из WB Round 1  → LB Round 1, slot participant_a
        #    - Проигравшие из WB Round 2  → LB Round 1, slot participant_b (пересечение)
        #    - Далее: победители LB Round r → LB Round r+1 slot participant_a, и т. д.
        for r in range(1, rounds_wb):
            for idx, wb_match in enumerate(matches_wb[r]):
                # loser отправляется либо в LB Round r (r = 1 → LB R1, r = 2 → LB R2, но здесь нужен аккуратный сдвиг)
                lb_round = r
                lb_idx = idx // 2  # индекс матча в раунде LB, куда попадёт проигравший
                target_lb_match = matches_lb[lb_round][lb_idx]
                # если слот participant_a свободен, кладём туда
                if target_lb_match.participant_a is None:
                    target_lb_match.participant_a = (
                        None  # по факту, увидит проигравшего после завершения WB
                    )
                    wb_match.next_match_loss = target_lb_match
                else:
                    # иначе p_b
                    wb_match.next_match_loss = target_lb_match
                wb_match.save(update_fields=["next_match_loss"])

        # 7) Связывание внутри LB: победитель LB r → LB r+1
        for r in range(1, total_lb_rounds):
            for idx, lb_match in enumerate(matches_lb[r]):
                next_r = r + 1
                next_idx = idx // 2
                next_match = matches_lb[next_r][next_idx]
                lb_match.next_match_win = next_match
                lb_match.save(update_fields=["next_match_win"])

        # 8) Финал между победителем WB (rounds_wb, WB) и победителем LB (total_lb_rounds, LB)
        wb_final = matches_wb[rounds_wb][0]  # единственный матч WB последнего раунда
        lb_final = matches_lb[total_lb_rounds][
            0
        ]  # единственный матч LB последнего раунда
        final_match = Match.objects.create(
            tournament=tournament,
            round_number=rounds_wb + 1,  # следующий раунд после WB финала
            bracket="WB",  # Финал «наверху», т.к. выигрывает победитель WB при ничьей
            participant_a=None,
            participant_b=None,
            start_time=base_time + timedelta(hours=rounds_wb),
        )
        # Связываем победителей
        wb_final.next_match_win = final_match
        wb_final.save(update_fields=["next_match_win"])
        lb_final.next_match_win = final_match
        lb_final.save(update_fields=["next_match_win"])
        # Готово.


def generate_round_robin(tournament: Tournament, teams: list[Team]):
    """
    Round-robin: каждый участник встречается с каждым ровно один раз.
    1) Если число команд нечётное, добавляем «бай» (None).
    2) Реализуем алгоритм «кругового» (circle method):
       - Фиксируем одну команду, остальные вращаем по кругу.
       - В каждом раунде формируем пары.
    3) Создаём для каждого раунда столько матчей, сколько участий (n/2).
       Сохраняем round_number, bracket="RR".
    """
    n = len(teams)
    is_odd = n % 2 == 1
    roster = teams.copy()
    if is_odd:
        roster.append(None)  # «бай» → пропуск

    total = len(roster)  # теперь чётное число
    rounds = total - 1  # если 6 участников → 5 раундов

    with transaction.atomic():
        for r in range(rounds):
            for i in range(total // 2):
                a = roster[i]
                b = roster[total - 1 - i]
                # Если один из них None → пропускаем создание матча (или создаём, но с status="bye")
                if a is None or b is None:
                    continue
                Match.objects.create(
                    tournament=tournament,
                    round_number=r + 1,
                    bracket="RR",
                    participant_a=a,
                    participant_b=b,
                )
            # «вращаем» все, кроме первой (индекс 0)
            roster = [roster[0]] + [roster[-1]] + roster[1:-1]
