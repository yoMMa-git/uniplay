# tournaments/utils.py

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
    bracket_list.extend([None] * (total_slots - n))

    # 3. Количество раундов = log2(total_slots)
    rounds = int(math.log2(total_slots))

    # 4. Создаём пустые объекты Match для каждого раунда заранее,
    #    чтобы иметь куда подключать next_match_win.
    matches_by_round: dict[int, list[Match]] = {r: [] for r in range(1, rounds + 1)}

    # --- вычисляем базовый час и будем раскладывать матчи по часам ---
    base_time = get_next_full_hour()

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

        # 5. Заполняем участников первого раунда
        for i, m in enumerate(matches_by_round[1]):
            m.participant_a = bracket_list[2 * i]
            m.participant_b = bracket_list[2 * i + 1]
            m.save(update_fields=["participant_a", "participant_b"])

        # 6. Связываем остальные раунды: победитель матча раунда r идет в round r+1
        for r in range(1, rounds):
            for idx, m in enumerate(matches_by_round[r]):
                next_match = matches_by_round[r + 1][idx // 2]
                m.next_match_win = next_match
                m.save(update_fields=["next_match_win"])

        # 7. Сетка готова (статус турнира поменяется снаружи).


def generate_double_bracket(tournament: Tournament, teams: list[Team]):
    """
    Double-elimination: строим две сетки — Winners Bracket (WB) и Losers Bracket (LB).
    Логика та же, что и раньше, но дополнительно присваиваем start_time.
    """
    n = len(teams)
    power = 1
    while power < n:
        power <<= 1
    total_slots = power

    # 2. Дополним список бай-слотами
    bracket_list = teams.copy()
    bracket_list.extend([None] * (total_slots - n))

    # 3. Сколько раундов в WB
    rounds_wb = int(math.log2(total_slots))

    matches_wb: dict[int, list[Match]] = {r: [] for r in range(1, rounds_wb + 1)}
    matches_lb: dict[int, list[Match]] = {}
    lb_rounds: list[int] = []

    # Базовый час
    base_time = get_next_full_hour()

    with transaction.atomic():
        # 4.1. Пустые матчи WB всех раундов
        for r in range(1, rounds_wb + 1):
            count_wb = total_slots // (2**r)
            round_time = base_time + timedelta(hours=(r - 1))
            for _ in range(count_wb):
                m = Match.objects.create(
                    tournament=tournament,
                    round_number=r,
                    bracket="WB",
                    participant_a=None,
                    participant_b=None,
                    start_time=round_time,
                )
                matches_wb[r].append(m)

        # 4.2. Заполняем участников первого раунда WB
        for idx, m in enumerate(matches_wb[1]):
            m.participant_a = bracket_list[2 * idx]
            m.participant_b = bracket_list[2 * idx + 1]
            m.save(update_fields=["participant_a", "participant_b"])

        # 4.3. Связываем победителей WB → WB (next_match_win)
        for r in range(1, rounds_wb):
            for idx, m in enumerate(matches_wb[r]):
                next_m = matches_wb[r + 1][idx // 2]
                m.next_match_win = next_m
                m.save(update_fields=["next_match_win"])

        # 5. Построим LB-раунды «по потребности», включая финал WB (r == rounds_wb)
        for r in range(1, rounds_wb + 1):
            # j = 2*r − 1 — потенциальный номер LB-раунда
            j = 2 * r - 1

            # Сколько проигравших из WB-r
            losers_count = total_slots // (2**r)

            # Победители предыдущего LB (если lb_rounds пуст, значит это первый LB)
            if not lb_rounds:
                prev_winners = 0
            else:
                prev_j = lb_rounds[-1]
                prev_winners = len(matches_lb[prev_j])

            participants = losers_count + prev_winners
            match_count = participants // 2

            # Если это финал LB (r == rounds_wb) и match_count < 1, сделать 1 матч
            if r == rounds_wb and match_count < 1:
                match_count = 1

            if match_count > 0:
                lb_rounds.append(j)
                matches_lb[j] = []
                # Для LB-раундов назначим start_time = base_time + (j−1) часов
                lb_time = base_time + timedelta(hours=(j - 1))
                for _ in range(match_count):
                    m_lb = Match.objects.create(
                        tournament=tournament,
                        round_number=j,
                        bracket="LB",
                        participant_a=None,
                        participant_b=None,
                        start_time=lb_time,
                    )
                    matches_lb[j].append(m_lb)

                # Связываем проигравших из WB-r → LB-j
                for idx, wb_match in enumerate(matches_wb[r]):
                    lb_idx = idx // 2
                    if lb_idx < len(matches_lb[j]):
                        target_lb = matches_lb[j][lb_idx]
                        wb_match.next_match_loss = target_lb
                        wb_match.save(update_fields=["next_match_loss"])

        # 6. Связываем победителей внутри LB (next_match_win)
        odd_rounds = lb_rounds.copy()  # например, [1, 3, 5]
        for idx_j, j in enumerate(odd_rounds[:-1]):
            next_j = odd_rounds[idx_j + 1]
            cur_list = matches_lb[j]
            next_list = matches_lb[next_j]

            # Если число матчей j = число матчей next_j → next_idx = idx_m
            if len(cur_list) == len(next_list):
                for idx_m, lb_match in enumerate(cur_list):
                    lb_match.next_match_win = next_list[idx_m]
                    lb_match.save(update_fields=["next_match_win"])
            else:
                # Иначе сгруппировать по два в один
                for idx_m, lb_match in enumerate(cur_list):
                    next_idx = idx_m // 2
                    if next_idx < len(next_list):
                        lb_match.next_match_win = next_list[next_idx]
                        lb_match.save(update_fields=["next_match_win"])

        # 7. Создаём Grand Final (финал турнира)
        wb_final = matches_wb[rounds_wb][0]  # единственный WB-финал
        lb_final = matches_lb[lb_rounds[-1]][0]  # единственный LB-финал
        grand_time = base_time + timedelta(hours=rounds_wb)  # сразу после всех раундов

        grand_final = Match.objects.create(
            tournament=tournament,
            round_number=rounds_wb + 1,
            bracket="WB",  # финал показываем как «верхний»
            participant_a=None,
            participant_b=None,
            start_time=grand_time,
        )

        wb_final.next_match_win = grand_final
        wb_final.save(update_fields=["next_match_win"])

        lb_final.next_match_win = grand_final
        lb_final.save(update_fields=["next_match_win"])


def generate_round_robin(tournament: Tournament, teams: list[Team]):
    """
    Round-robin: каждый участник встречается с каждым ровно один раз.
    1) Если число команд нечётное, добавляем «бай» (None).
    2) Реализуем алгоритм «кругового» (circle method):
       - Фиксируем одну команду, остальные вращаем по кругу.
       - В каждом раунде формируем пары.
    3) Создаём для каждого раунда столько матчей, сколько участий (n/2).
       Сохраняем round_number, bracket="RR" и назначаем start_time.
    """
    n = len(teams)
    is_odd = n % 2 == 1
    roster = teams.copy()
    if is_odd:
        roster.append(None)  # «бай»

    total = len(roster)  # теперь чётное число
    rounds = total - 1  # если 6 участников → 5 раундов

    # Базовый час для RR
    base_time = get_next_full_hour()

    with transaction.atomic():
        for r in range(rounds):
            round_time = base_time + timedelta(hours=r)
            for i in range(total // 2):
                a = roster[i]
                b = roster[total - 1 - i]
                # Если один из них None → пропускаем
                if a is None or b is None:
                    continue
                Match.objects.create(
                    tournament=tournament,
                    round_number=r + 1,
                    bracket="RR",
                    participant_a=a,
                    participant_b=b,
                    start_time=round_time,
                )
            # «вращаем» всех, кроме первого
            roster = [roster[0]] + [roster[-1]] + roster[1:-1]
