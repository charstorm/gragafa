from dataclasses import dataclass, field

import numpy as np
import matplotlib.pyplot as plt
import matplotlib.animation as animation
from matplotlib.patches import Rectangle
from matplotlib.artist import Artist
from matplotlib.lines import Line2D
from matplotlib.text import Text as TextAnnotation

EPS = 1e-4


@dataclass
class Vec2D:
    """Represents a 2D vector or point."""

    x: float = 0.0
    y: float = 0.0

    def as_tuple(self) -> tuple[float, float]:
        return (self.x, self.y)

    def copy(self) -> "Vec2D":
        return Vec2D(self.x, self.y)

    def add(self, other: "Vec2D") -> "Vec2D":
        self.x += other.x
        self.y += other.y
        return self

    def scale(self, alpha: float) -> "Vec2D":
        self.x *= alpha
        self.y *= alpha
        return self

    def l2norm(self) -> float:
        result: float = (self.x * self.x + self.y * self.y) ** 0.5
        return result

    @staticmethod
    def random() -> "Vec2D":
        x, y = np.random.rand(2)
        return Vec2D(x, y)


@dataclass
class RectBox:
    """Specification for a rectangle."""

    position: Vec2D
    velocity: Vec2D
    acceleration: Vec2D
    shape: Vec2D
    force: Vec2D = field(default_factory=Vec2D)

    def get_center(self) -> Vec2D:
        """Returns the center coordinates of the rectangle."""
        center_x = self.position.x + self.shape.x / 2
        center_y = self.position.y + self.shape.y / 2
        return Vec2D(center_x, center_y)

    def is_overlapping(self, other: "RectBox") -> bool:
        # Check for overlap
        is_overlapping = not (
            self.position.x + self.shape.x < other.position.x
            or self.position.x > other.position.x + other.shape.x
            or self.position.y + self.shape.y < other.position.y
            or self.position.y > other.position.y + other.shape.y
        )
        return is_overlapping


@dataclass
class Node:
    """Represents the node of a graph"""

    node_id: int
    related_to: list[int] = field(default_factory=list)
    depends_on: list[int] = field(default_factory=list)
    level: int = 0


Graph = list[Node]
Connections = list[tuple[int, int]]


def extract_connections(graph: Graph) -> tuple[Connections, Connections]:
    unique_connections: set[tuple[int, int]] = set()
    dependencies: set[tuple[int, int]] = set()
    for node_id, node in enumerate(graph):
        if node.node_id != node_id:
            raise ValueError(f"Node idx={node_id} is not matching with node's id")
        for relative in node.related_to:
            smaller = min(node_id, relative)
            bigger = max(node_id, relative)
            unique_connections.add((smaller, bigger))
            if bigger >= len(graph):
                raise ValueError(f"node_id {bigger} has no Node defined")
        for dependency in node.depends_on:
            if dependency >= len(graph):
                raise ValueError(f"{dependency=} does not exist ({node_id=})")
            dependencies.add((node_id, dependency))
    return sorted(list(unique_connections)), list(dependencies)


def create_test_graph() -> Graph:
    return [
        Node(0, [], []),
        Node(1, [], [0]),
        Node(2, [], [0, 1]),
        Node(3, [], [0]),
        Node(4, [], [1]),
        Node(5, [], [2, 0]),
        Node(6, [], [3, 0]),
        Node(7, [], [0, 3, 4, 5]),
        Node(8, [], [5, 6]),
        Node(9, [], [4, 6, 8]),
        Node(10, [], [8, 9]),
        Node(11, [], [8, 9]),
        Node(12, [], [7, 8, 9]),
        Node(13, [], [0, 1, 2]),
        Node(14, [], [12, 13])
    ]


@dataclass
class Config:
    box_width: float = 2
    box_height: float = 1
    attraction_coef: float = 1
    repulsion_coef: float = 50
    repulsion_xscale: float = 4
    level_coef: float = 5
    level_offset: float = 3
    overlap_scale: float = 2
    slowing_coef: float = 0.5
    box_color: str = "blue"
    canvas_size: float = 20
    time_step: float = 0.1
    mass: float = 1


def get_starting_positions(separation: float, num_nodes: int) -> list[Vec2D]:
    angles = np.arange(num_nodes) * (2 * np.pi / num_nodes)
    result = []
    for angle in angles:
        position = Vec2D(x=separation * np.cos(angle), y=separation * np.sin(angle))
        result.append(position)
    np.random.shuffle(result)  # type: ignore
    return result


def get_random_unit_vector() -> Vec2D:
    angle = np.random.uniform(0, 2 * np.pi)
    return Vec2D(np.cos(angle), np.sin(angle))


class GraphAnimation:
    def __init__(
        self,
        config: Config,
        graph: Graph,
        connections: Connections,
        dependencies: Connections,
    ) -> None:
        self.config = config
        self.graph = graph
        self.connections = connections
        self.dependencies = dependencies

        max_width = max(config.box_width, config.box_height)
        separation = 2 * len(graph) * max_width / (2 * np.pi)
        self.node_boxes = self.create_inital_rectangles(
            separation, len(graph), config.box_width, config.box_height
        )

        self.fig, self.ax = plt.subplots(figsize=(7, 7))

        self.lines: list[Line2D] = []

        for src_idx, dst_idx in self.connections:
            src_pos = self.node_boxes[src_idx].get_center()
            dst_pos = self.node_boxes[dst_idx].get_center()
            (line,) = self.ax.plot(
                [src_pos.x, dst_pos.x],
                [src_pos.y, dst_pos.y],
                "k-",
                lw=2,
            )
            self.lines.append(line)

        self.rect_patches: list[Rectangle] = []
        self.annotations: list[TextAnnotation] = []
        for node_id, rect in enumerate(self.node_boxes):
            rect_patch = Rectangle(
                (rect.position.x, rect.position.y),
                rect.shape.x,
                rect.shape.y,
                angle=0,
                color=config.box_color,
                fill=True,
                zorder=2,
            )
            self.ax.add_patch(rect_patch)
            self.rect_patches.append(rect_patch)

            # label = str(graph[node_id].level)
            label = str(node_id)
            text = self.ax.annotate(
                label, (rect.position.x, rect.position.y), fontsize=12, color="white"
            )
            self.annotations.append(text)

        self.ax.set_xlim(-config.canvas_size, config.canvas_size)
        self.ax.set_ylim(-config.canvas_size, config.canvas_size)
        self.ax.set_aspect("equal")
        plt.tight_layout()

    def create_inital_rectangles(
        self, separation: float, num_nodes: int, width: float, height: float
    ) -> list[RectBox]:
        positions = get_starting_positions(separation, num_nodes)
        rectangles: list[RectBox] = []
        for position in positions:
            position.x -= width / 2
            position.y -= height / 2
            rect = RectBox(
                position=position,
                velocity=Vec2D(),
                acceleration=Vec2D(),
                shape=Vec2D(x=width, y=height),
            )
            rectangles.append(rect)
        return rectangles

    def clear_force_all(self) -> None:
        for rect in self.node_boxes:
            rect.force = Vec2D()

    def compute_coloumb_repulsive_force(self, b1: RectBox, b2: RectBox) -> Vec2D:
        """
        Compute force on b1 due to b2.

        Force on b2 due to b1 is the exact opposite.
        """
        coef = self.config.repulsion_coef
        xscale = self.config.repulsion_xscale
        overlap_scale = self.config.overlap_scale

        p1 = b1.get_center().copy()
        p2 = b2.get_center().copy()

        diff = p1.add(p2.scale(-1))  # p1 - p2
        diff_norm = diff.l2norm()
        if diff_norm < EPS:
            diff_norm = EPS
        diff_unit = diff.scale(1 / diff_norm)

        force_magnitude = coef / (diff_norm**2)
        if b1.is_overlapping(b2):
            force_magnitude *= overlap_scale

        force_vec = diff_unit.scale(force_magnitude)
        force_vec.x *= xscale
        return force_vec

    def compute_repulsive_all(self) -> None:
        """
        Every node repel every other node.
        Repulsion is increased if the nodes overlap.
        """
        for src_idx in range(len(self.graph)):
            for dst_idx in range(src_idx + 1, len(self.graph)):
                src_box = self.node_boxes[src_idx]
                dst_box = self.node_boxes[dst_idx]

                src_force = self.compute_coloumb_repulsive_force(src_box, dst_box)
                dst_force = src_force.copy().scale(-1)
                src_box.force.add(src_force)
                dst_box.force.add(dst_force)

    def compute_level_force(self, child: RectBox, parent: RectBox) -> Vec2D:
        coef = self.config.level_coef
        offset = self.config.level_offset
        y_child = child.position.y
        y_parent = parent.position.y
        y_diff = y_child - (y_parent + offset)
        force = 0.0
        if y_diff < 0:
            force = coef * min(abs(y_diff), 1)
        result = Vec2D(0, -force)
        return result

    def compute_level_force_all(self) -> None:
        for child_idx, parent_idx in self.dependencies:
            child_box = self.node_boxes[child_idx]
            parent_box = self.node_boxes[parent_idx]
            child_force = self.compute_level_force(child_box, parent_box)
            parent_force = child_force.copy().scale(-1)
            child_box.force.add(child_force)
            parent_box.force.add(parent_force)

    def compute_attractive_force(self, b1: RectBox, b2: RectBox) -> Vec2D:
        if b1.is_overlapping(b2):
            return Vec2D()

        coef = self.config.attraction_coef

        p1 = b1.get_center().copy()
        p2 = b2.get_center().copy()

        diff = p1.add(p2.scale(-1))  # p1 - p2
        diff_norm = diff.l2norm()
        if diff_norm < EPS:
            diff_norm = EPS
        diff_unit = diff.scale(1 / diff_norm)
        if diff_norm <= EPS:
            diff_unit = get_random_unit_vector()

        force_magnitude = coef * diff_norm
        force_vec = diff_unit.scale(-force_magnitude)
        return force_vec

    def compute_attractive_all(self) -> None:
        # TODO: cleanup repeated code!
        for src_idx, dst_idx in self.connections:
            src_box = self.node_boxes[src_idx]
            dst_box = self.node_boxes[dst_idx]
            src_force = self.compute_attractive_force(src_box, dst_box)
            dst_force = src_force.copy().scale(-1)
            src_box.force.add(src_force)
            dst_box.force.add(dst_force)

    def compute_slowing_all(self) -> None:
        coef = self.config.slowing_coef
        for box in self.node_boxes:
            veclocity = box.velocity
            norm = veclocity.l2norm()
            if norm < EPS:
                norm = EPS
            veclocity_unit = veclocity.copy().scale(1 / norm)
            force_magnitude = coef * norm
            force_vec = veclocity_unit.scale(-force_magnitude)
            box.force.add(force_vec)

    def update_position_all(self) -> None:
        time_step = self.config.time_step
        mass = self.config.mass
        limit = self.config.canvas_size - 2
        for box in self.node_boxes:
            box.acceleration = box.force.scale(1 / mass)
            box.velocity.add(box.acceleration.copy().scale(time_step))
            box.position.add(box.velocity.copy().scale(time_step))
            box.position.x = max(-limit, min(limit, box.position.x))
            box.position.y = max(-limit, min(limit, box.position.y))

    def run_simulation(self) -> None:
        """Update node positions"""
        self.clear_force_all()
        self.compute_repulsive_all()
        self.compute_level_force_all()
        self.compute_attractive_all()
        self.compute_slowing_all()
        self.update_position_all()

    def update_patches(self) -> None:
        for box, rect, text in zip(
            self.node_boxes, self.rect_patches, self.annotations
        ):
            rect.set_xy((box.position.x, box.position.y))
            text.set_position((box.position.x, box.position.y))

        for conn, line in zip(self.connections, self.lines):
            src_idx, dst_idx = conn
            x1, y1 = self.node_boxes[src_idx].get_center().as_tuple()
            x2, y2 = self.node_boxes[dst_idx].get_center().as_tuple()
            line.set_data([x1, x2], [y1, y2])

    def animate(self, i: int) -> list[Artist]:
        self.run_simulation()
        self.update_patches()
        result: list[Artist] = [*self.rect_patches, *self.lines]
        return result

    def start_animation(self) -> None:
        _anim = animation.FuncAnimation(
            self.fig, self.animate, frames=1000000, interval=10
        )
        plt.show()


def assign_level_to_nodes_inplace(graph: Graph) -> Graph:
    # step 1: build children for each node
    # If a depends on b, a is a child of b
    child_map: list[list[int]] = [[] for node in graph]
    for node in graph:
        for parent in node.depends_on:
            child_map[parent].append(node.node_id)

    # initialize levels
    for node in graph:
        node.level = 0

    # Set of nodes without a level assigned
    unassigned = [node.node_id for node in graph]
    tainted: list[int] = []
    max_steps = len(graph) + 1
    for _step in range(max_steps):
        tainted = []
        for node_id in unassigned:
            level = graph[node_id].level
            for child_id in child_map[node_id]:
                graph[child_id].level = level + 1
                tainted.append(child_id)

        unassigned = list(set(tainted))
        tainted = []
        if not unassigned:
            break

    if unassigned:
        raise ValueError(f"Cycle detected: {unassigned}")

    return graph


def combine_dependencies_inplace(graph: Graph) -> Graph:
    for node in graph:
        connections = set(node.related_to)
        connections.update(node.depends_on)
        node.related_to = list(connections)
    return graph


def preprocess_graph_inplce(graph: Graph) -> Graph:
    graph = assign_level_to_nodes_inplace(graph)
    graph = combine_dependencies_inplace(graph)
    return graph


def print_graph(graph: Graph) -> None:
    for node in graph:
        print(node)


def main() -> None:
    np.random.seed(2)
    config = Config()
    graph = create_test_graph()
    graph = preprocess_graph_inplce(graph)
    print_graph(graph)
    connections, dependencies = extract_connections(graph)
    graph_anim = GraphAnimation(config, graph, connections, dependencies)
    graph_anim.start_animation()


if __name__ == "__main__":
    main()
